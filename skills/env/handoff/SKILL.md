---
name: handoff
description: Hands a task off to a new standalone Pi session in a fresh Orca worktree, then stops work on it. Use when the user asks to run, continue, or give a task in a new worktree or to another agent.
argument-hint: "<task description>"
user-invocable: true
disable-model-invocation: false
---

# Handoff

## Core Contract

Transfer ownership of one task to a new, persistent Pi session that runs in its own Orca worktree. The current session creates the worktree, starts the session, reports, and stops work on the task. Never use `subagent` for this: a subagent stays attached to the parent session and closes when it finishes. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task, from the invocation or the conversation.
2. Worktree name: derive a short kebab-case name from the task.
3. Optional model and thinking level. Otherwise use the task-scale rules in the system prompt, or `pi`'s defaults when none exist.

## Workflow

1. Resolve the Orca CLI: `ORCA_CLI_COMMAND` if set, else `orca-dev` if `ORCA_DEV_REPO_ROOT` is set, else `orca-ide` on Linux outside an Orca terminal, else `orca`. Substitute it for `ORCA` below.
2. Create the worktree: `ORCA worktree create --name <name> --no-parent --json`. Omit `--agent`. Add `--base-branch` only when the user asks for stacked work. Read `result.worktree.path` from the output.
3. Write a self-contained task brief to a file outside the worktree, for example `$(mktemp -d)/brief.md`. Include the goal, relevant paths, constraints, current-branch context, and the expected result. The new session does not see this conversation.
4. Start the session: `ORCA terminal create --worktree path:<worktree-path> --title <name> --command 'pi --model <model> --thinking <level> "$(cat <brief-file>)"' --json`. Omit `--model` and `--thinking` when not chosen.
5. The handoff is done when the terminal is created. Report the worktree path, branch, and terminal handle. Do not wait for the new session, and do not do the task in this session.

## Safety Rules

- Never use `subagent`, `--agent`, or `orca agent launch` for the handoff.
- Never run bare `orca` on Linux outside an Orca terminal: it may start the GNOME screen reader.
- Never put secrets in the brief file.
- Never use `orca orchestration` task or dispatch commands: a handoff is not supervised orchestration.
- If `terminal create` fails, check `ORCA terminal list --worktree path:<worktree-path> --json` before retrying, so two sessions do not start.

## Output Style

Report the worktree path, branch, terminal handle, model, and brief file path. State that the session stays open for the user.
