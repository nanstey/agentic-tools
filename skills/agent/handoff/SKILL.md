---
name: handoff
description: Hands a task off to a new standalone Pi session in a fresh Orca worktree that drives it to review-ready PRs with idea-to-pr, then stops work on it. Use when the user asks to run, continue, or give a task in a new worktree or to another agent.
argument-hint: "<task description>"
user-invocable: true
disable-model-invocation: false
---

# Handoff

## Core Contract

Transfer ownership of one task to a new, persistent Pi session that runs in its own Orca worktree. The new session drives the task with the `idea-to-pr` skill, from discovery to review-ready PRs. The current session creates the worktree, starts the session, reports, and stops work on the task. Never use `Agent` for this: a Lite agent stays attached to the parent session and returns when it finishes. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task, from the invocation or the conversation.
2. Worktree name: derive a short kebab-case name from the task.
3. Optional `idea-to-pr` mode: `autopilot` (default) or `gated`.
4. Optional model and thinking level. Otherwise choose the tier under the task-scale rules, use the `worker` row of the model table, and pass its `provider/model-id` plus the tier's thinking level.

## Workflow

1. Resolve the Orca CLI: `ORCA_CLI_COMMAND` if set, else `orca-dev` if `ORCA_DEV_REPO_ROOT` is set, else `orca-ide` on Linux outside an Orca terminal, else `orca`. Substitute it for `ORCA` below.
2. Create the worktree: `ORCA worktree create --name <name> --no-parent --json`. Omit `--agent`. Add `--base-branch` only when the user asks for stacked work. Read `result.worktree.path` from the output.
3. Write a self-contained task brief to a file outside the worktree, for example `$(mktemp -d)/brief.md`. The new session does not see this conversation. The brief starts with this instruction: "Load and follow the `idea-to-pr` skill on the task below, in `<mode>` mode. This worktree is already isolated for this task: do not create another worktree or branch for the first slice unless the plan needs dependent PRs." Then include the goal, relevant paths, constraints, current-branch context, and expected result.
4. Start the session: `ORCA terminal create --worktree path:<worktree-path> --title <name> --command 'pi --model <provider/model-id> --thinking <tier-level> "$(cat <brief-file>)"' --json`. Omit `--model` and `--thinking` only when no tier/model selection exists.
5. The handoff is done when the terminal is created. Report the worktree path, branch, and terminal handle. Do not wait for the new session, and do not do the task in this session.

## Safety Rules

- Never use `Agent`, `--agent`, or `orca agent launch` for the handoff.
- Never run bare `orca` on Linux outside an Orca terminal: it may start the GNOME screen reader.
- Never put secrets in the brief file.
- Never run `idea-to-pr` in this session: the new session owns it.
- Never use `orca orchestration` task or dispatch commands: a handoff is not supervised orchestration.
- If `terminal create` fails, check `ORCA terminal list --worktree path:<worktree-path> --json` before retrying, so two sessions do not start.

## Output Style

Report the worktree path, branch, terminal handle, model, and brief file path. State that the session stays open for the user.
