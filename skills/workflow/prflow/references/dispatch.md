# prflow Pi dispatch

How `prflow tick` hands `ci`, `comments`, and `behind` work to Pi sessions in
Orca, watches them, and recovers. Code: `scripts/agents.ts` (flow),
`scripts/core/brief.ts` (briefs), `scripts/adapters/orca.ts` (Orca calls).

## Switch

| Config | Default | Effect |
| --- | --- | --- |
| `dispatch.dryRun` | `true` | No launch, message, nudge, or close. Each brief is announced once per item version as a `dry-run` event with its exact target and text |
| `tick --dry-run` | off | Forces dry run for both the safe actions and dispatch |

`dispatch.dryRun` is separate from `actions.dryRun`, so reruns and cleanup can
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

`orca-ide agent read` cannot read Pi terminal transcripts, so a session's state
and last message come from `agent list` (`state`, `lastAssistantMessage`,
`updatedAt`), joined to `terminal list` (`handle`, `lastOutputAt`) on
`paneKey = <tabId>:<leafId>`. A Pi terminal with no agent row has state
`unknown`. Launches always use `--surface terminal` so prflow can mail and close
the session.

## Briefs

Templates live in `templates/briefs/<kind>.md`. The first line,
`<!-- prflow brief: <kind> v<n> -->`, is the version; bump it whenever a
template changes. Placeholders are `{{name}}`; a missing value fails the brief
instead of sending it half-filled.

| Kind | Details filled in |
| --- | --- |
| `ci` | Each failed check: name, log URL, and up to 20 error lines from `gh run view --job <id> --log-failed` (first 5 Actions jobs) |
| `comments` | Human comments and reviews newer than the head commit and the author's last reply, and unresolved threads whose last comment is a human's: author, `file:line`, URL, text. Informational approvals are left out |
| `behind` | BEHIND or DIRTY. The brief merges the base in; it never rebases, because a rebase of a pushed branch needs a force-push |
| `nudge` | Sent once to an idle session whose work is unfinished |

Each brief also carries the branch, base, head, worktree, other open triggers,
the project context pointer (config `dispatch.projectContext`), and, on a
retry, the previous attempt's end reason and last message. Each ends with the
no-self-edit note.

## Lifecycle

```
(item ci|comments|behind, worktree found)
  any Pi session busy           -> planned (retried each tick)
  idle Pi session               -> launched: brief sent with orchestration send
  no Pi session                 -> launched: fresh Pi launched with the brief
launched|working:
  new activity                  -> working, lease renewed
  idle or gone, PR moved on     -> done (session-finished)
  idle, work unfinished         -> nudged once (lease renewed)
  idle again after the nudge    -> stale
  session closed, unfinished    -> stale
  busy past stuckMinutes        -> stale (done if the PR moved on)
  lease expired                 -> stale
planned past its lease          -> stale
stale|failed (next tick)        -> planned again, attempts + 1: close the old
                                   session, launch fresh with the brief and
                                   what the last attempt left
attempts = maxAttempts          -> abandoned, item paused
```

"The PR moved on" means a new head, a new feedback version on the same head,
the dispatch's trigger no longer firing, or the PR no longer being an open,
non-draft PR of yours.

Rules that hold throughout:

- One agent dispatch per item at a time. A newer version waits until the open
  one settles.
- A busy session is never messaged, nudged, or launched beside. Busy means
  `working`, `blocked`, `waiting`, or `unknown`.
- Only the session an earlier attempt of the same dispatch used is ever closed.
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
| Launch or message | `launched` row with lease, target, worktree, send time, and brief |
| Nudge | `nudged_at`, renewed lease, `nudged` event |
| Close for a retry | the retry's `planned` row and `dispatched` event |

A crash after a launch leaves a `launched` row with no session handle. At the
start of the next tick prflow lists the worktree's Pi sessions and adopts the
one active since the launch (`recovered`); otherwise the lease decides.

## Events

| Event | When |
| --- | --- |
| `dispatched` | A dispatch is planned, or a deferred one is delivered |
| `dry-run` | Dispatch dry run: the target and the full brief |
| `nudged` | One nudge to an idle session, with its last message |
| `session-finished` | Done; detail has the reason and the session's last message (500 characters) |
| `session-stale` | Stale; detail has the reason and the last message |
| `recovered` | An orphaned row adopted its session |
| `action-failed` | Launch, message, or close failed; the dispatch is `failed` |
| `needs-decision` | No worktree, several worktrees, or a launch Orca could not confirm reached Pi |
| `abandoned`, `paused` | `maxAttempts` reached |

## State

`dispatches` rows for agent kinds also hold `worktree` (Orca worktree id),
`sent_at`, `seen_at` (last activity seen), `nudged_at`, `brief`, and
`last_message`. `sessions` holds one row per session handle prflow used, with
its dispatch, last activity, and state. `prflow status` and the report's
In flight group show each open dispatch's session handle, state, age, lease,
and attempt.
