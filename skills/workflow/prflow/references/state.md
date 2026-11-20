# prflow state and rails

## Files

All state lives in one directory, `${XDG_STATE_HOME:-~/.local/state}/prflow/`
(`--state-dir <path>` overrides it).

| File | Purpose |
| --- | --- |
| `prflow.db` | SQLite: `items`, `dispatches`, `sessions`, `runs`, `ledger`, `meta` |
| `paused` | Present while prflow is paused; holds the reason |
| `events.jsonl` | Append-only event feed for the orchestration layer |
| `watch-<name>.txt` | `prflow watch` state (unchanged from phase 1) |
| `drafts/<owner>-<repo>-<n>/<head8>/` | One review draft: `review.md` (written by the reviewer), `meta.json` and `post.json` (written by prflow); see `references/review.md` |

Only prflow writes these files, except each `review.md`, which its reviewer session writes. Use `pause`, `resume`, `recover`, `review`, and `import-legacy`.

## Tables

| Table | Rows |
| --- | --- |
| `items` | Latest classification per item key (`owner/repo#N`, case-insensitive), last seen time, pause flag and reason |
| `dispatches` | One row per (item, version, kind): state, attempts, lease, session handle, detail; agent dispatches add worktree, send, activity, and nudge times, brief, and last message (`references/dispatch.md`) |
| `sessions` | Agent sessions prflow dispatched to: handle, item, dispatch, last activity, state |
| `runs` | One row per tick: start, finish, ok, dry run, item and event counts, error |
| `ledger` | Append-only outcomes: `started`, final dispatch states, and `legacy-dispatched` imports |
| `meta` | Event feed offset, report fingerprint, failure count, next tick time, last scan time, and the tick lock (`tick_lock`: pid, time, token). The lock is checked and taken in one `BEGIN IMMEDIATE` transaction, taken over when its process is gone or after 6 hours, and released only by its holder |

## Events

One JSON object per line:

```json
{"ts":"2026-01-12T17:00:00.000Z","type":"paused","item":"acme/widgets#12","version":null,"kind":null,"dispatchId":null,"sessionHandle":null,"detail":"loop breaker: 3 starts for this version in 24h (limit 3)"}
```

Every key is always present; unknown values are `null`. `item` is `null` for
events about prflow itself. Types: `dispatched`, `nudged`, `interrupted`, `recovered`,
`session-finished`, `session-stale`, `abandoned`, `rerun`, `archived`,
`docs-committed`, `paused`, `resumed`, `rail-tripped`, `action-failed` (an
action failed; its dispatch is `failed`), `needs-decision` (prflow will not act
and asks the user), `dry-run` (the action prflow would take), and the review
events `review-started`, `review-drafted`, and `review-posted`
(`references/review.md`).

Action events: a live action emits `dispatched` before its command, then
`rerun` or `archived` on success, or `action-failed`. `needs-decision` and
`dry-run` are emitted once per item version (tracked by unique ledger refs).

## Dispatch lifecycle

```
planned -> launched -> working -> done | failed | stale | abandoned
failed | stale -> planned   (retry, attempts + 1)
```

- **Idempotency:** one row per (item, version, kind). An open row blocks a second
  start; a `done` or `abandoned` row ends that version. Version is the head sha8
  plus a digest of comments, reviews, and threads, so new feedback is new work.
  A `review-requested` dispatch uses the head sha8 alone: one review per head.
- **Write before acting:** a start writes the `planned` row, a `started` ledger
  row, and its event before any side effect.
- **Agent dispatches** (`ci`, `comments`, `behind`) follow `references/dispatch.md`,
  and reviewer dispatches (`review-requested`) follow `references/review.md`:
  a monitor step before reconcile renews leases on session activity and settles,
  nudges, or marks them stale.
- **Leases:** a launched dispatch holds a lease (`leaseMinutes`). A tick marks any
  open dispatch `stale` once its lease ran out (a `planned` row uses its last
  update time) and emits `session-stale`. Facts that settle a dispatch earlier
  emit `recovered`.
- **Retries:** a `failed` or `stale` dispatch may start again until it reaches
  `maxAttempts`; then it becomes `abandoned`, the item is paused, and prflow
  emits `abandoned` and `paused`. `prflow recover <id>` resets a dispatch to
  `stale` with 0 attempts and restarts the item's loop-breaker count.
- **Legacy:** a dispatch is skipped when an imported legacy entry has the same
  item, kind, and head sha prefix (and comment timestamp, when recorded).

## Rails

All limits come from the config `prflow.rails` object; see `SKILL.md` for defaults.

| Rail | Effect |
| --- | --- |
| Caps: `startsPerTick`, `maxOpen`, `perHour`, `perDay` | The start waits for a later tick. `rail-tripped` is emitted once per tick (per-tick and open caps), hour, or day |
| Reviewers: `prflow.review.maxConcurrent` (default 2) | Reviewer dispatches open at once; more wait, with `rail-tripped` once per tick. In dry run it caps announcements per tick |
| Loop breaker: `loopSameVersion` starts for one item and version, or `loopAcrossVersions` starts for one item, in 24 hours | The item is paused; `rail-tripped` and `paused` are emitted |
| Backoff: `backoffBaseMinutes`, doubling to `backoffMaxMinutes` | After a failed tick, ticks before the next allowed time exit 0 with no output |
| Poll budget: `pollBudgetSeconds` | A scan that takes longer fails the tick |
| Child timeout: `childTimeoutSeconds` | Each `gh`, `git`, or `orca-ide` process is killed after this and counts as failed |
| Pause | While prflow is paused, `tick` does nothing: no scan, no actions, no output. Its events print on the first tick after `prflow resume`. A paused item is still scanned and reported but starts nothing |
| Reruns: `rerunsPerVersion` (default 2) | Checks cancelled again at the same item version are rerun up to this many times (dispatch versions `<version>`, `<version>~r2`, ...). Then the item is paused once with a reason; after `prflow resume --item` that version is not rerun again. A new head or new comments start a fresh count |
| Dry run | Config `prflow.actions.dryRun`, `prflow.dispatch.dryRun`, and `prflow.review.dryRun` (each default `true`) or `tick --dry-run`: no side effects; dry-run announcements honour `startsPerTick` |
| Busy wait: `busyWaitMinutes` | A busy Pi session may hold up a brief this long; then prflow interrupts it and restarts it with the brief (`references/dispatch.md`) |

## Tick

1. Skip silently while backing off or while another tick holds the lock.
2. Scan within the poll budget. Any scan error fails the tick: no state
   besides the failed run and the backoff is written, and the exit code is 1.
3. Record items, watch open agent dispatches' and reviewers' Pi sessions
   (`references/dispatch.md`, `references/review.md`), record saved reviewer
   drafts and sync review statuses, then reconcile open dispatches: a `rerun`
   is done when the same head has checks running again, a `cleanup` when its
   worktree is no longer listed; review worktrees remain until PR close/merge.
4. Act: reruns first, then worktree cleanups (see `SKILL.md`, Actions), then
   Pi dispatch (see `SKILL.md`, Pi Dispatch), then reviewers (`SKILL.md`,
   Review Drafts).
5. Print new events since the last successful tick, then the grouped report
   when its fingerprint changed (lease times are not part of it). A report
   that becomes empty prints `Nothing to report.` A PR whose checks are still
   running keeps, in the fingerprint, the head the last printed report showed,
   so a new head alone reprints nothing until its checks finish; a review
   request the last report showed that now waits for required checks on a new
   head counts the same way. Each reprinted row says what changed since the
   last printed report (`changed: new head d5f5da28, retitled`, `new comments
   or reviews`, `was <kind>`, `checks finished`, `new`). The rows that report
   showed are kept in `meta.report_items`.
