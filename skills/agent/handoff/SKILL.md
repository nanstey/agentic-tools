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
2. Resolve `<target-repo-root>` from the target repository. Run `ORCA repo list --json`, match `path` first, and use `displayName` only when it identifies one entry. Report and stop on no match or ambiguity; point to `orca-repo` when registration is needed, and do not create a worktree in the current repository.
3. Run `git -C <target-repo-root> fetch origin`; report and stop if it fails. Get `<default-branch>` from `git -C <target-repo-root> symbolic-ref --short refs/remotes/origin/HEAD` without its `origin/` prefix. If `git -C <target-repo-root> rev-list --count <default-branch>..origin/<default-branch>` is nonzero, add `--base-branch origin/<default-branch>`; also add it when the user asks for stacked work.
4. Create the worktree: `ORCA worktree create --repo path:<target-repo-root> --name <name> --no-parent --json`. Omit `--agent`. Read `result.worktree.path` from the output.
5. Write a self-contained task brief to a file outside the worktree. Run `brief_dir="$(mktemp -d)"` and use `<brief-file>` for `$brief_dir/brief.md`; stop and report if `mktemp` fails. The new session does not see this conversation. The brief starts with this instruction: "Load and follow the `idea-to-pr` skill on the task below, in `<mode>` mode. This worktree is already isolated for this task: do not create another worktree or branch for the first slice unless the plan needs dependent PRs." Then include the goal, relevant paths, constraints, the target repository's current-branch context, and expected result.
6. Reuse the worktree's implicit initial terminal. Send only to a terminal that passes every check below. If there is no terminal yet or no prompt yet, re-check up to 3 times about 2 seconds apart; never send during a re-check. Otherwise, on any failed check or error, use the failure report. Never create or choose another terminal.
   - `ORCA terminal list --worktree path:<worktree-path> --json` returns exactly one terminal row, with a nonempty `handle` (call it `<terminal-handle>`) and no `agentIdentity`.
   - `ORCA terminal read --terminal <terminal-handle> --screen --json` returns `result.terminal.source` of `screen`, `status` of `running`, and `draft` absent or empty.
   - The last nonempty row of `result.terminal.tail` is an idle shell prompt with nothing typed after it. It visibly ends in a prompt marker such as `$`, `#`, or `%`. Reject continuation, password, choice, recovery, or program prompts, and truncated, limited, unavailable, or ambiguous screen output.
7. Launch Pi in that terminal in four sub-steps, in one Bash invocation with literal values substituted for placeholders.
   1. Validate. Require `[[ "<brief-file>" =~ ^/[A-Za-z0-9._/-]+$ ]]`. When a tier/model selection exists, also require `<model>` and `<thinking>` to match `^[A-Za-z0-9][A-Za-z0-9._/-]*$`. Stop with the failure report on any mismatch. These patterns admit no shell syntax.
   2. Build. Set `launch_options="--model <model> --thinking <thinking>"` only when a tier/model selection exists, otherwise leave it empty. Then build the command; the quoted substitution passes the brief contents to Pi as one argument:
      ```bash
      launch_command="pi${launch_options:+ $launch_options} \"\$(cat \"<brief-file>\")\""
      ```
   3. Send once: `ORCA terminal send --terminal <terminal-handle> --text "$launch_command" --enter --wait-submit 10 --json`.
   4. Read the receipt once. `accepted: true` means Orca accepted the input, even if `--wait-submit` later times out; do not resend. Only after an ambiguous transport failure with a reported retry request may you rerun the same send with `--retry-request <id>` and the same handle. On no retry request, a failed replay, a stale handle, or any other unaccepted result, use the failure report and send nothing more.
8. When the send receipt confirms input acceptance, the handoff is done. Follow the single Output Style report contract. Do not wait for the new session, and do not do the task in this session.

## Safety Rules

- Never use `Agent`, `--agent`, or `orca agent launch` for the handoff.
- Never run bare `orca` on Linux outside an Orca terminal: it may start the GNOME screen reader.
- Never create a worktree in the caller's repository when the target repository is unresolved or unregistered.
- Never put secrets in the brief file.
- Never run `idea-to-pr` in this session: the new session owns it.
- Never use `orca orchestration` task or dispatch commands: a handoff is not supervised orchestration.
- Never suppress, close, or create a terminal: this workflow preserves Orca's implicit initial terminal.

## Output Style

Report the worktree path, branch, reused terminal handle, selected model or the absence of a model selection, brief file path, and whether Orca accepted the launch input. Acceptance proves only that Orca accepted the input, so never claim Pi has started; say the session stays open for the user.

**Failure report:** state that the worktree was created but Pi was not confirmed as started, and why.
