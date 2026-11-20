# prflow Pi dispatch

How `prflow tick` hands `ci`, `comments`, and `behind` work to Pi sessions in
Orca, watches them, and recovers. Reviewer sessions for `review-requested`
reuse this monitor and recovery; see `references/review.md`. Code: `scripts/agents.ts` (flow),
`scripts/core/brief.ts` (briefs), `scripts/adapters/orca.ts` (Orca calls).

## Switch

| Config | Default | Effect |
| --- | --- | --- |
| `prflow.dispatch.dryRun` | `true` | No launch, message, nudge, or close. Each brief is announced once per item version as a `dry-run` event with its exact target and text |
| `tick --dry-run` | off | Forces dry run for both the safe actions and dispatch |

`prflow.dispatch.dryRun` is separate from `prflow.actions.dryRun`, so reruns and cleanup can
go live while dispatch stays announced. Keep dispatch in dry run while any
other automation still sends the same briefs.

## Orca calls

Every `orca-ide` call passes `assertOrca`; anything else throws before it runs.

| Purpose | Call |
| --- | --- |
| Find the worktree | `orca-ide worktree list --limit 1000 --json` |
| Read sessions | `orca-ide agent list --json`, `orca-ide terminal list --worktree id:<id> --json` |
| Launch | `orca-ide agent launch --agent pi --surface terminal --worktree id:<id> --prompt <brief> --json` |
| Message | `orca-ide orchestration send --to <term_… or orca_session_id:…> --subject <s> --body <brief> --json` |
| Close | `orca-ide terminal close --terminal <term_…> --json` |
| Interrupt | `orca-ide terminal send --terminal <term_…> --text <Escape> --json`, then `orca-ide terminal wait --terminal <term_…> --for tui-idle --timeout-ms 30000 --json` |
| Review worktree (reviewers only) | `orca-ide worktree create --repo id:<repoId> --name prflow-review-<repo>-<n> --branch prflow-review/<repo>-<n> --pr <n> --no-parent --setup run --json` (`assertReviewWorktree`), without the caller's Orca identity (`detachedEnv`); `worktree set --worktree path:<review path> --no-parent --json` if Orca still nests it (`assertWorktreeUnparent`) |
| Tick review status sync | `orca-ide worktree set --worktree path:<absolute review path> --workspace-status <id> --comment <single line> [--unread|--read] --json` (`assertWorktreeSet`) |
| Reviewer draft status (reviewer only) | After saving a draft, one `orca-ide worktree set --worktree active --workspace-status <id> --comment "draft: <verdict>, <n> inline, not posted" --unread --json`; no other reviewer Orca writes |

`orca-ide agent read` cannot read Pi terminal transcripts, so a session's state
and last message come from `agent list` (`state`, `lastAssistantMessage`,
`updatedAt`), joined to `terminal list` (`handle`, `lastOutputAt`) on
`paneKey = <tabId>:<leafId>`. A Pi terminal with no agent row has state
`unknown`. Launches always use `--surface terminal` so prflow can mail, stop,
and close the session. Escape is the only raw input prflow ever types; Pi ends
its turn on it. A brief is sent only after `terminal wait` sees the prompt.

## Briefs

Templates live in `templates/briefs/<kind>.md`. The first line,
`<!-- prflow brief: <kind> v<n> -->`, is the version; bump it whenever a
template changes. Placeholders are `{{name}}`; a missing value fails the brief
instead of sending it half-filled.

| Kind | Details filled in |
| --- | --- |
| `ci` | Each failed check: name, log URL, and up to 20 error lines from `gh run view --job <id> --log-failed` (first 5 Actions jobs) |
| `comments` | Human comments and reviews newer than the head commit and the author's last reply, and unresolved threads whose last comment is a human's: author, `file:line`, URL, text. Informational approvals are left out |
| `behind` | BEHIND or DIRTY. The brief has the agent read the PR's current base (`gh pr view --json baseRefName`), rebase onto `origin/<base>` (dropping merged parent commits in a stack), and push with `--force-with-lease`, the only force-push any brief allows |
| `nudge` | Sent once to an idle session whose work is unfinished |
| `restart` | Wraps a full brief for a session prflow restarts in place: why, then a request for an immediate update (what it was doing, what is done, what is left) before it starts again |

Each brief also carries the branch, base, head, worktree, other open triggers,
the project context pointer (config `prflow.dispatch.projectContext`), and, on a
retry, the previous attempt's end reason and last message. Each ends with the
no-self-edit note.

## Lifecycle

```
(item ci|comments|behind, worktree found)
  any Pi session busy           -> planned (retried each tick)
  busy busyWaitMinutes, alone   -> launched: Escape, wait for the prompt, then
                                   the restart brief in the same session
  several busy, or a busy chat  -> planned; stale one lease after the wait
  idle Pi session               -> launched: brief sent with orchestration send
  no Pi session                 -> launched: fresh Pi launched with the brief
launched|working:
  new activity                  -> working, lease renewed
  idle or gone, PR moved on     -> done (session-finished)
  idle, work unfinished         -> nudged once (lease renewed)
  idle again after the nudge    -> stale
  session closed, unfinished    -> stale
  busy busyWaitMinutes after
  the brief                     -> stale (done if the PR moved on); the retry
                                   interrupts and restarts the same session
  lease expired                 -> stale
planned past its lease          -> stale
stale|failed (next tick)        -> planned again, attempts + 1, with the brief
                                   and what the last attempt left: close the
                                   old session and launch fresh, or, after a
                                   busy session or a failed interrupt,
                                   interrupt and restart that same session
attempts = maxAttempts          -> abandoned, item paused
prflow recover <id>             -> stale with 0 attempts; the next tick retries
```

"The PR moved on" means a new head, a new feedback version on the same head,
the dispatch's trigger no longer firing, or the PR no longer being an open,
non-draft PR of yours.

Rules that hold throughout:

- One agent dispatch per item at a time. A newer version waits until the open
  one settles.
- A busy session is never messaged, nudged, or launched beside. Busy means
  `working`, `blocked`, `waiting`, or `unknown`. After `busyWaitMinutes` (45)
  a lone busy Pi terminal is stopped with Escape, and messaged only once
  `terminal wait` shows its prompt. A briefed session in `unknown` state with
  no activity is left to the lease rather than the busy limit.
- Only the session an earlier attempt of the same dispatch used is ever closed,
  and never while it is busy (including `unknown`): the retry waits
  `busyWaitMinutes`, then interrupts and restarts it in place.
  If closing fails, the attempt fails rather than launching a second session.
- No worktree, or several matches: `needs-decision` once per item version.
- `ci` and `behind` briefs wait for running checks to finish.
- Caps, the loop breaker, pauses, and legacy dedupe apply through
  `beginDispatch`, as for the safe actions.

## Crash safety

Each side effect is preceded by a committed row change and an event:

| Step | Written first |
| --- | --- |
| Plan | `planned` row, `started` ledger row, `dispatched` event (brief id and target) |
| Deliver a deferred plan | `dispatched` event (`… (was waiting)`) |
| Launch or message | `launched` row with lease, target, worktree, send time, brief, and the session handles already in the worktree |
| Nudge | `nudged_at`, renewed lease, `nudged` event |
| Interrupt | `launched` row (as above), then an `interrupted` event |
| Close for a retry | the retry's `planned` row and `dispatched` event |

A crash after a launch leaves a `launched` row with no session handle. At the
start of the next tick prflow lists the worktree's Pi sessions and adopts the
Pi terminal that was not there before the launch, even before it prints
anything (`recovered`); otherwise the lease decides.

## Events

| Event | When |
| --- | --- |
| `dispatched` | A dispatch is planned, or a deferred one is delivered |
| `dry-run` | Dispatch dry run: the target and the full brief |
| `nudged` | One nudge to an idle session, with its last message |
| `interrupted` | A busy session is stopped with Escape before its restart brief; detail has why and its last message |
| `session-finished` | Done; detail has the reason and the session's last message (500 characters) |
| `session-stale` | Stale; detail has the reason and the last message |
| `recovered` | An orphaned row adopted its session, or `prflow recover` reset a dispatch |
| `action-failed` | Launch, message, or close failed; the dispatch is `failed` |
| `needs-decision` | No worktree, several worktrees, or a launch Orca could not confirm reached Pi |
| `abandoned`, `paused` | `maxAttempts` reached |

## State

`dispatches` rows for agent kinds also hold `worktree` (Orca worktree id),
`sent_at`, `seen_at` (last activity seen), `nudged_at`, `brief`,
`last_message`, `known_sessions` (handles present before a launch),
`wait_since` (when a planned dispatch began waiting on a busy session), and
`restart_handle` (a session to interrupt and reuse on the next attempt).
`sessions` holds one row per session handle prflow used, with its dispatch,
last activity, and state. `prflow status` and the report's In flight group
show each open dispatch's session handle, state, age, lease, and attempt.

## Recover by hand

`prflow recover <dispatchId>` resets one dispatch: an open one is marked
`stale` first, so the next tick replaces its session; a `failed`, `stale`, or
`abandoned` one goes back to `stale` with 0 attempts. A `recovered` ledger row
restarts the item's loop-breaker count, and a pause caused by this dispatch or
the loop breaker is lifted (any other pause stays). A `done` dispatch cannot be
recovered. The retry runs only while the PR still has the same version and
kind; otherwise the new version gets its own dispatch anyway.
