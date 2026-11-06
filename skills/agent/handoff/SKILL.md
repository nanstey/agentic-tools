---
name: handoff
description: Hands a task off to a new standalone Pi session in a fresh Orca worktree that drives it to review-ready PRs with idea-to-pr, then stops work on it. Use when the user asks to run, continue, or give a task in a new worktree or to another agent.
argument-hint: "<task description>"
user-invocable: true
disable-model-invocation: false
---

# Handoff

## Core Contract

Transfer ownership of one task to a new, persistent Pi session that runs in its own Orca worktree. The new session drives the task with the `idea-to-pr` skill, from discovery to review-ready PRs. The current session creates the worktree, submits the Pi launch input through Orca's implicit initial terminal, reports, and stops work on the task. Never use `Agent` for this: a Lite agent stays attached to the parent session and returns when it finishes. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task, from the invocation or the conversation.
2. Worktree name: derive a short kebab-case name from the task.
3. Optional `idea-to-pr` mode: `autopilot` (default) or `gated`.
4. Optional model and thinking level. Otherwise choose the tier under the task-scale rules, use the `worker` row of the model table, and pass its `provider/model-id` plus the tier's thinking level.
5. Target repository: the repository whose code the task changes. Use the current repository only when the task names no other repository, files, or project; report that default.

## Workflow

1. Resolve the Orca CLI: `ORCA_CLI_COMMAND` if set, else `orca-dev` if `ORCA_DEV_REPO_ROOT` is set, else `orca-ide` on Linux outside an Orca terminal, else `orca`. Substitute it for `ORCA` below.
2. Resolve `<target-repo-root>`: run `ORCA repo list --json`, match `path` first, and use `displayName` only when it identifies one entry. On no match or ambiguity, stop and report; point to `orca-repo` when registration is needed. Never create a worktree in the current repository.
3. Run `git -C <target-repo-root> fetch origin`; stop and report on failure. Get `<default-branch>` from `git -C <target-repo-root> symbolic-ref --short refs/remotes/origin/HEAD`, minus `origin/`. If `git -C <target-repo-root> rev-list --count <default-branch>..origin/<default-branch>` is nonzero, or the user asks for stacked work, add `--base-branch origin/<default-branch>`.
4. Create the worktree: `ORCA worktree create --repo path:<target-repo-root> --name <name> --no-parent --json`. Omit `--agent`. Read `result.worktree.path`.
5. Write a self-contained brief outside the worktree: `brief_dir="$(mktemp -d)"`, `<brief-file>` is `$brief_dir/brief.md`; stop and report if `mktemp` fails. The new session cannot see this conversation. Start the brief with: "Load and follow the `idea-to-pr` skill on the task below, in `<mode>` mode. This worktree is already isolated for this task: do not create another worktree or branch for the first slice unless the plan needs dependent PRs." Then add the goal, relevant paths, constraints, the target repository's current-branch context, and expected result.
6. Reuse the worktree's implicit initial terminal; never create or choose another. Send only when every check passes. If no terminal or prompt exists yet, re-check up to 3 times, about 2 seconds apart, without sending. Any other failure or error: failure report.
   - `ORCA terminal list --worktree path:<worktree-path> --json` returns exactly one row, with a nonempty `handle` (`<terminal-handle>`) and no `agentIdentity`.
   - `ORCA terminal read --terminal <terminal-handle> --screen --json` returns `result.terminal.source` `screen`, `status` `running`, and `draft` absent or empty.
   - The last nonempty `result.terminal.tail` row is an idle shell prompt ending in a marker such as `$`, `#`, or `%`, with nothing typed after it. Reject continuation, password, choice, recovery, or program prompts, and truncated, limited, unavailable, or ambiguous output.
7. Launch Pi in one Bash invocation, with literal values substituted for placeholders:
   1. Validate before any value reaches shell syntax. A value containing a single quote: failure report. Otherwise assign `brief_file='<brief-file>'` (and, with a tier/model selection, `model='<model>'`, `thinking='<thinking>'`). Require `[[ "$brief_file" =~ ^/[A-Za-z0-9._/-]+$ ]]` and, for model and thinking, `[[ "$model" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ && "$thinking" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]]`. Any mismatch: failure report.
   2. Build. Set `launch_options="--model $model --thinking $thinking"` only with a tier/model selection, else leave it empty:
      ```bash
      launch_command="pi${launch_options:+ $launch_options} \"\$(cat \"$brief_file\")\""
      ```
   3. Send once: `ORCA terminal send --terminal <terminal-handle> --text "$launch_command" --enter --wait-submit 10 --json`.
   4. Read the receipt once. `accepted: true` means Orca accepted the input, even if `--wait-submit` times out; never resend. Only after an ambiguous transport failure with a reported retry request, rerun the same send with `--retry-request <id>` and the same handle. Otherwise (no retry request, failed replay, stale handle, unaccepted result): failure report, send nothing more.
8. On accepted input the handoff is done. Report per Output Style. Do not wait for the new session or do the task here.

## Safety Rules

- Never use `Agent`, `--agent`, or `orca agent launch` for the handoff.
- Never run bare `orca` on Linux outside an Orca terminal: it may start the GNOME screen reader.
- Never create a worktree in the caller's repository when the target repository is unresolved or unregistered.
- Never put secrets in the brief file.
- Never run `idea-to-pr` in this session: the new session owns it.
- Never use `orca orchestration` task or dispatch commands: a handoff is not supervised orchestration.
- Never suppress, close, or create a terminal: this workflow preserves Orca's implicit initial terminal. Explicit terminal or agent requests outside this handoff keep their documented launch flows.

## Output Style

Report the worktree path, branch, reused terminal handle, selected model or none, brief file path, and whether Orca accepted the launch input. Acceptance does not prove Pi started: say the session stays open for the user.

**Failure report:** the worktree was created but Pi was not confirmed as started, and why.
