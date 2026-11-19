# prflow state and rails

## Files

All state lives in one directory, `${XDG_STATE_HOME:-~/.local/state}/prflow/`
(`--state-dir <path>` overrides it).

| File | Purpose |
| --- | --- |
| `prflow.db` | SQLite: `items`, `dispatches`, `sessions`, `runs`, `ledger`, `meta` |
| `paused` | Present while prflow is paused; holds the reason |
| `tick.lock` | Held while a tick runs (pid and a unique token). Taken over when its process is gone, or after 6 hours (30 minutes when it names no pid). A tick removes only its own lock |
| `events.jsonl` | Append-only event feed for the orchestration layer |
| `watch-<name>.txt` | `prflow watch` state (unchanged from phase 1) |

Only prflow writes these files. Use `pause`, `resume`, and `import-legacy`.

## Tables

| Table | Rows |
| --- | --- |
| `items` | Latest classification per item key (`owner/repo#N`, case-insensitive), last seen time, pause flag and reason |
| `dispatches` | One row per (item, version, kind): state, attempts, lease, session handle, detail |
| `sessions` | Agent sessions tied to dispatches (filled from phase 4) |
| `runs` | One row per tick: start, finish, ok, dry run, item and event counts, error |
| `ledger` | Append-only outcomes: `started`, final dispatch states, and `legacy-dispatched` imports |
| `meta` | Event feed offset, report fingerprint, failure count, next tick time, last scan time |

## Events

One JSON object per line:

```json
{"ts":"2026-01-12T17:00:00.000Z","type":"paused","item":"acme/widgets#12","version":null,"kind":null,"dispatchId":null,"sessionHandle":null,"detail":"loop breaker: 3 starts for this version in 24h (limit 3)"}
```

Every key is always present; unknown values are `null`. `item` is `null` for
events about prflow itself. Types: `dispatched`, `nudged`, `recovered`,
`session-finished`, `session-stale`, `abandoned`, `rerun`, `archived`,
`docs-committed`, `paused`, `resumed`, `rail-tripped`.

## Dispatch lifecycle

```
planned -> launched -> working -> done | failed | stale | abandoned
failed | stale -> planned   (retry, attempts + 1)
```

- **Idempotency:** one row per (item, version, kind). An open row blocks a second
  start; a `done` or `abandoned` row ends that version. Version is the head sha8
  plus a digest of comments, reviews, and threads, so new feedback is new work.
- **Write before acting:** a start writes the `planned` row, a `started` ledger
  row, and its event before any side effect.
- **Leases:** a launched dispatch holds a lease (`leaseMinutes`). A tick marks any
  open dispatch `stale` once its lease ran out (a `planned` row uses its last
  update time) and emits `session-stale`. Facts that settle a dispatch earlier
  emit `recovered`.
- **Retries:** a `failed` or `stale` dispatch may start again until it reaches
  `maxAttempts`; then it becomes `abandoned`, the item is paused, and prflow
  emits `abandoned` and `paused`.
- **Legacy:** a dispatch is skipped when an imported legacy entry has the same
  item, kind, and head sha prefix (and comment timestamp, when recorded).

## Rails

All limits come from the config `rails` object; see `SKILL.md` for defaults.

| Rail | Effect |
| --- | --- |
| Caps: `startsPerTick`, `maxOpen`, `perHour`, `perDay` | The start waits for a later tick. `rail-tripped` is emitted once per tick (per-tick and open caps), hour, or day |
| Loop breaker: `loopSameVersion` starts for one item and version, or `loopAcrossVersions` starts for one item, in 24 hours | The item is paused; `rail-tripped` and `paused` are emitted |
| Backoff: `backoffBaseMinutes`, doubling to `backoffMaxMinutes` | After a failed tick, ticks before the next allowed time exit 0 with no output |
| Poll budget: `pollBudgetSeconds` | A scan that takes longer fails the tick |
| Child timeout: `childTimeoutSeconds` | Each `gh`, `git`, or `orca-ide` process is killed after this and counts as failed |
| Pause | While prflow is paused, `tick` does nothing: no scan, no actions, no output. Its events print on the first tick after `prflow resume`. A paused item is still scanned and reported but starts nothing |

## Tick

1. Skip silently while backing off or while another tick holds the lock.
2. Scan within the poll budget. Any scan error fails the tick: no state
   besides the failed run and the backoff is written, and the exit code is 1.
3. Record items, then reconcile open dispatches (leases, recovery).
4. Print new events since the last successful tick, then the grouped report
   when its fingerprint changed (lease times are not part of it). A report
   that becomes empty prints `Nothing to report.`
