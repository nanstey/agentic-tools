---
name: orca-task-status
description: Keeps the agent's own Orca worktree board status current (In Progress, Needs Attention, Blocked, Paused, In Review, Done) at the start and end of every response, and removes the worktree after its PR merges once no work remains. Use when starting or ending a response inside an Orca worktree, or when the user asks to set, check, or clean up this task's status.
argument-hint: "[start|end [--outcome finished|needs-input|blocked|paused]|set <state>|show|cleanup] [--resume]"
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
| `blocked` | The task depends on other work that is not done. | `end --outcome blocked` |
| `paused` | Work stopped indefinitely. Usually set by the user. | `end --outcome paused`, only when the user asks to pause |
| `in-review` | The PR waits for CI, reviewers, or merge. | `end` |
| `done` | The PR is ready to merge or has merged. | `end` |

## Workflow

1. **Start of every response:** run `start` before other work. Add `--resume` only when the current status is Paused and the user asked for work on this task. Without it, a Paused card stays Paused.
2. Do the work.
3. **End of every response:** run `end` as the last command before the final report (only `cleanup` may follow it), with the outcome that matches how the response ends:
   - `finished` (default): the requested work is complete and nothing is asked of the user. The CLI derives the state from the PR (table below).
   - `needs-input`: the response asks the user a question, needs a decision, or stops on a failure the agent cannot resolve.
   - `blocked`: the task waits for other work, such as another PR or task, before it can continue.
   - `paused`: the user asked to stop this task indefinitely.
   Pass `--resume` again when step 1 used it.
4. **Cleanup:** when `end` prints `cleanup: eligible`, follow [Cleanup](#cleanup).

`set <state>` writes one state directly when the user asks for it. `show` prints the current state, what `end` would set, and cleanup eligibility, and writes nothing.

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
- Never set Paused unless the user asked. Never leave Paused without `--resume`, and use `--resume` only when the user asked for work on this task.
- Never run `cleanup` while instructions for this task remain, after a refusal, or in a subagent.
- Never remove a worktree with `--force`, `--delete-branch`, or a selector other than the captured `id:`.
- A skipped or failed status write never blocks the user's task. Report it once and continue.

## Output Style

Each command prints one line per action, such as `in-progress -> in-review (PR #12 is waiting for checks)`, `unchanged: done (PR #12 merged)`, `kept paused: ...`, or `skipped: <reason>`. Mention a status change in the final report only when it failed or is not the expected result.
