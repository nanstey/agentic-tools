---
name: handoff
description: Hands a task off to a new standalone Pi session in a fresh Orca worktree that drives it to review-ready PRs with idea-to-pr, then stops work on it. Use when the user asks to run, continue, or give a task in a new worktree or to another agent.
argument-hint: "<task description>"
user-invocable: true
disable-model-invocation: false
---

# Handoff

## Core Contract

Transfer ownership of one task to a new, persistent Pi session that runs in its own Orca worktree. The new session drives the task with the `idea-to-pr` skill, from discovery to review-ready PRs. The current session creates the worktree and sends the input that starts Pi through the implicit initial terminal of Orca. Then it reports and stops work on the task. Never use `Agent` for this: a delegated child stays attached to the parent session and returns when it finishes. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task, from the invocation or the conversation.
2. Worktree name: derive a short kebab-case name from the task.
3. Optional `idea-to-pr` mode: `autopilot` (default) or `gated`.
4. Optional model and thinking level. Otherwise choose the tier under the task-scale rules, use the `worker` row of the model table, and pass its `provider/model-id` plus the tier's thinking level.
5. Target repository: the repository whose code the task changes. If the task names no other repository, file, or project, use the current repository and report that default.

## Workflow

1. Select the Orca CLI command. Use `ORCA_CLI_COMMAND` if it exists. Else use `orca-dev` if `ORCA_DEV_REPO_ROOT` exists. Else use `orca-ide` on Linux outside an Orca terminal. Else use `orca`. Put it in place of `ORCA` below.
2. Find `<target-repo-root>`. Run `ORCA repo list --json` and match `path` first. Use `displayName` only when it identifies one entry. If no entry matches, or more than one matches, stop and report. If registration is needed, point to `orca-repo`. Never create a worktree in the current repository.
3. Run `git -C <target-repo-root> fetch origin`. If it fails, stop and report. Get `<default-branch>` from `git -C <target-repo-root> symbolic-ref --short refs/remotes/origin/HEAD`, without the `origin/` prefix. If `git -C <target-repo-root> rev-list --count <default-branch>..origin/<default-branch>` is not zero, or the user asks for stacked work, add `--base-branch origin/<default-branch>`.
4. Create the worktree: `ORCA worktree create --repo path:<target-repo-root> --name <name> --no-parent --json`. Omit `--agent`. Read `result.worktree.path`.
5. Write a self-contained brief to a file outside the worktree. First run `brief_dir="$(mktemp -d)"`. `<brief-file>` is `$brief_dir/brief.md`. If `mktemp` fails, stop and report. The new session cannot see this conversation. The brief must start with this text: "Load and follow the `idea-to-pr` skill on the task below, in `<mode>` mode. This worktree is already isolated for this task: do not create another worktree or branch for the first slice unless the plan needs dependent PRs." Then add the goal, relevant paths, constraints, the current-branch context of the target repository, and the expected result.
6. Use the implicit initial terminal of the worktree. Never create or choose another terminal. Send only when every check below passes. If no terminal or prompt exists yet, check again up to 3 times, about 2 seconds apart. Do not send during these checks. For any other failure or error, use the failure report.
   - `ORCA terminal list --worktree path:<worktree-path> --json` returns exactly one row, with a nonempty `handle` (`<terminal-handle>`) and no `agentIdentity`.
   - `ORCA terminal read --terminal <terminal-handle> --screen --json` returns `result.terminal.source` `screen`, `status` `running`, and `draft` absent or empty.
   - The last nonempty `result.terminal.tail` row is an idle shell prompt ending in a marker such as `$`, `#`, or `%`, with nothing typed after it. Reject continuation, password, choice, recovery, or program prompts, and truncated, limited, unavailable, or ambiguous output.
7. Start Pi in one Bash invocation, with literal values substituted for placeholders:
   1. Check the values before they reach shell syntax. If a value contains a single quote, use the failure report. Otherwise assign `brief_file='<brief-file>'`. With a tier/model selection, also assign `model='<model>'` and `thinking='<thinking>'`. Require `[[ "$brief_file" =~ ^/[A-Za-z0-9._/-]+$ ]]`. For model and thinking, require `[[ "$model" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && "$thinking" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]]`. If a check fails, use the failure report.
   2. Build. Set `launch_options="--model $model --thinking $thinking"` only with a tier/model selection, else leave it empty:
      ```bash
      launch_command="pi${launch_options:+ $launch_options} \"\$(cat \"$brief_file\")\""
      ```
   3. Send once: `ORCA terminal send --terminal <terminal-handle> --text "$launch_command" --enter --wait-submit 10 --json`.
   4. Read the receipt once. `accepted: true` means Orca accepted the input, even if `--wait-submit` times out. Never resend. If a transport failure is ambiguous and the receipt gives a retry request, run the same send again with `--retry-request <id>` and the same handle. In all other cases, use the failure report and send nothing more. These cases are: no retry request, failed replay, stale handle, or unaccepted result.
8. When Orca accepts the input, the handoff is complete. Report as in Output Style. Do not wait for the new session. Do not do the task in this session.

## Safety Rules

- Never use `Agent`, `--agent`, or `orca agent launch` for the handoff.
- Never run bare `orca` on Linux outside an Orca terminal: it may start the GNOME screen reader.
- Never create a worktree in the caller's repository when the target repository is not found or not registered.
- Never put secrets in the brief file.
- Never run `idea-to-pr` in this session: the new session owns it.
- Never use `orca orchestration` task or dispatch commands: a handoff is not supervised orchestration.
- Never suppress, close, or create a terminal: this workflow preserves Orca's implicit initial terminal. Explicit terminal or agent requests outside this handoff keep their documented flows.

## Output Style

Report the worktree path, branch, reused terminal handle, selected model or none, brief file path, and whether Orca accepted the input that starts Pi. Acceptance does not prove Pi started: say the session stays open for the user.

**Failure report:** state that the worktree exists, that Pi did not start or was not shown to start, and the reason.
