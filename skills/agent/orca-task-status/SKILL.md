---
name: orca-task-status
description: Keeps the agent's own Orca worktree board status current (In Progress, Needs Attention, Blocked, Paused, In Review, Done) at the start and end of every response, and removes the worktree after its PR merges once no work remains. Use when starting or ending a response inside an Orca worktree, or when the user asks to set, check, or clean up this task's status.
argument-hint: "[start|end [--outcome finished|needs-input|blocked|paused]|set <state>|show|cleanup] [--resume] [--reason <why> --until <condition>...]"
user-invocable: true
disable-model-invocation: false
---

# orca-task-status

## Core Contract

Run the `task-status.ts` CLI to move this worktree's Orca board card. The agent decides its outcome; the CLI turns that outcome and the branch PR into one board state and writes it with the Orca CLI (`ORCA_CLI_COMMAND`, else `orca-ide`): `worktree set --worktree id:<id> --workspace-status <status-id> --json`. It acts only on the worktree that contains the current directory.
It skips, printing `skipped: <reason>` and exiting 0, when the Orca CLI is not installed, the directory is not an Orca worktree, the worktree is a main checkout, the branch is a `prflow-review/` worktree (prflow owns those), or `ORCA_TASK_STATUS=0`. Any other Orca failure exits 1.
Only the main agent of a session runs it. Leaf agents (no `Agent` tool) and subagents never do.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Command: `node <skill-dir>/scripts/task-status.ts <command>` (Node 22.18+). Tests: `npm test` in the skill directory.

## States

| State | Meaning | Set by |
| --- | --- | --- |
| `in-progress` | The agent is working on the task. | `start` |
| `needs-attention` | The agent needs input or a further instruction. | `end --outcome needs-input`, or `end` when the PR needs action, has no PR, or local changes are not on the PR |
| `blocked` | The task depends on other work that is not done. Records why and what unblocks it. | `end --outcome blocked --reason <why> --until <condition>` |
| `paused` | Work stopped indefinitely. Usually set by the user. | `end --outcome paused`, only when the user asks to pause |
| `in-review` | The PR waits for CI, reviewers, or merge. | `end` |
| `done` | The PR is ready to merge or has merged. | `end` |

## Workflow

1. **Start of every response:** run `start` before other work. Add `--resume` only when the current status is Paused and the user asked for work on this task. Without it, a Paused card stays Paused.
2. Do the work.
3. **End of every response:** run `end` as the last command before the final report (only `cleanup` may follow it), with the outcome that matches how the response ends:
   - `finished` (default): the requested work is complete and nothing is asked of the user. The CLI derives the state from the PR (table below).
   - `needs-input`: the response asks the user a question, needs a decision, or stops on a failure the agent cannot resolve.
   - `blocked`: the task waits for other work, such as another PR or task, before it can continue. Add `--reason` and `--until` ([Blocked](#blocked)).
   - `paused`: the user asked to stop this task indefinitely.
   Pass `--resume` again when step 1 used it.
4. **Cleanup:** when `end` prints `cleanup: eligible`, follow [Cleanup](#cleanup).

`set <state>` writes one state directly when the user asks for it. `set blocked` also needs `--reason` and `--until`. `show` prints the current state, what `end` would set, and cleanup eligibility, and writes nothing.

### PR-derived state for `finished`

The CLI reads `gh pr view <branch> --repo <owner/repo>` with the shared-config account for that repo. Checks run in this order:

| Condition | State |
| --- | --- |
| No PR for the branch | `needs-attention` |
| PR merged | `done` |
| PR closed without merging, uncommitted changes, local `HEAD` not equal to the PR head, draft PR, failing check, changes requested, or merge conflicts | `needs-attention` |
| A check is pending | `in-review` |
| Approved or no review required, and GitHub reports `CLEAN` or `HAS_HOOKS` | `done` |
| Otherwise (review required, branch behind, unknown) | `in-review` |

A `gh` failure other than "no pull requests found" exits 1 and writes nothing. Then choose the state yourself and run `set <state>`.

## Blocked

`end --outcome blocked` and `set blocked` need `--reason "<why>"` (one line, at most 160 characters) and one or more `--until <condition>`. Without them the command exits 2 and writes nothing. `--reason` and `--until` with any other state also exit 2. Every condition must hold before the card leaves Blocked:

| Condition | Holds when |
| --- | --- |
| `checks-pass` | This branch's PR has no pending or failing required checks. When the repo marks no check required, every check counts. |
| `pr-approved` | This branch's PR is approved (`reviewDecision` `APPROVED`). |
| `pr-merged <owner/repo#n>` | That PR merged. Also written `pr-merged=<owner/repo#n>`. |
| `manual` | Never. Only a person unblocks it. It cannot be combined with other conditions. |

The set stays small on purpose: each condition is one read-only `gh` call and covers one common wait (CI, a review, a dependency PR). There is no `pr-review` condition: "someone reviewed another PR" does not say whether this task can continue. Use `pr-merged` for a dependency, or `manual`.

Choose the condition that ends the wait. Use `manual` only when no check fits, such as a decision by a person.

The command writes:

- A record in `${XDG_STATE_HOME:-~/.local/state}/agentic-tools/blocked.json`, keyed by the Orca worktree id: reason, conditions, set time, worktree path, branch, repo, and PR number when the branch has one.
- The card comment `Blocked: <reason> · until: <conditions>`, in the same `worktree set` call as the status.

Running it on a card that is already Blocked replaces the record and comment. Any other state removes the record and clears a comment that starts with `Blocked: `. Other comments stay. A failed status write removes the new record again.

`prflow tick` reads the records. When every condition holds, it moves the card to the state that `finished` would give (the table above, from the same shared code in `lib/task-status.ts`), sets the comment to what changed, and marks the card unread. A Blocked card with no record or with only `manual` is reported once and is never moved. `show` prints the record.

## Cleanup

`cleanup` removes this worktree from Orca with `worktree rm --worktree id:<id> --json` (no `--force`, no `--delete-branch`). It refuses, exiting 1, unless every condition holds:

- The PR for the branch is `MERGED` with a `mergedAt` time.
- `git status --porcelain` is empty, untracked files included.
- Local `HEAD` equals the merged PR head, so no later commit is lost.
- The Paused status id is configured and the card is not Paused, the worktree has no child worktrees, and it is not a main checkout or prflow review worktree.

Run it only when no work remains for this task. That includes post-merge instructions from the user or the task brief, such as release steps, follow-up issues, deploy checks, or notes. Do those first. Report them with `end --outcome finished` and confirm `cleanup: eligible` again.

Removal ends this session. Write the final report in the same message, before the `cleanup` call, and make `cleanup` the last tool call. If it succeeds, nothing follows. If it refuses or fails, the session continues: reply once with the reason and run no further commands. Do not retry with other flags or selectors.

## Configuration

The board status ids come from the shared agentic-tools config (`--config <path>`, `AGENTIC_TOOLS_CONFIG`, `<repo-root>/config.json`, then `${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json`), in `taskStatus.statuses`. Orca's built-in columns are the defaults: `in-progress`, `in-review`, and `completed` for `done`. Paused, Blocked, and Needs Attention are custom columns with generated ids such as `status-7`. Set them in the config. A state without an id exits 1 and writes nothing. To find an id, set a card to that column in Orca, then read `workspaceStatus` from `orca-ide worktree current --json` in that worktree.

## Safety Rules

- Never change another worktree's status. Write only through `id:<id>` of the current worktree.
- Never set Blocked without a reason and a condition that ends the wait. Prefer a checkable condition to `manual`.
- Never set Paused unless the user asked. Never leave Paused without `--resume`, and use `--resume` only when the user asked for work on this task.
- Never run `cleanup` while instructions for this task remain, after a refusal, or in a subagent.
- Never remove a worktree with `--force`, `--delete-branch`, or a selector other than the captured `id:`.
- A skipped or failed status write never blocks the user's task. Report it once and continue.

## Output Style

Each command prints one line per action, such as `in-progress -> in-review (PR #12 is waiting for checks)`, `unchanged: done (PR #12 merged)`, `kept paused: ...`, or `skipped: <reason>`. Mention a status change in the final report only when it failed or is not the expected result.
