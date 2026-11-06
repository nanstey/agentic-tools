# Proposal: suppress implicit Orca worktree terminals

## Purpose

A new worktree started through the handoff workflow should not open a terminal unless the caller explicitly requests one. The handoff skill adds one Pi terminal, and `orca worktree create --help` says Orca creates the first terminal by default. The installed CLI has no suppression flag; a possible Orca global default-terminal setting is unverified.

## User story and scenarios

1. Given a caller creates a worktree without requesting a terminal, when Orca creates it, then no terminal opens.
2. Given a caller starts an agent with `--surface chat`, when Orca creates the worktree, then the launch outcome is chat and `orca terminal list` reports no terminal.
3. Given a caller explicitly requests `--surface terminal` or creates a terminal, when Orca starts the worktree or agent, then the terminal behavior remains available.
4. Given chat is unavailable after worktree creation, when Orca falls back to terminal, then the launch receipt explains that fallback.

## Behaviour and QA

The installed CLI documents a first terminal by default and has no `--no-terminal` option. The target repository’s registered settings expose no default-terminal control. The scenarios cannot pass from this repository until an Orca setting or CLI/API capability is verified. A future Orca integration test must create disposable worktrees for the four scenarios and assert `orca terminal list --worktree ... --json` results and launch receipt fields.

## Architecture

The control point is an Orca default-terminal setting or `worktree create` CLI/API capability, not a versioned setting in this repository. The handoff skill is a caller of that API. Editing it can remove its separate `terminal create`, but that also requires a replacement Pi launch path plus changes to its terminal-based retry, completion, and reporting contracts. It cannot suppress the initial terminal without the external control.

## Affected areas

- External: verify an Orca default-terminal setting or add a `worktree create` terminal-suppression option.
- Later repository follow-up: redesign `skills/agent/handoff/SKILL.md` to use the external control, choose a replacement Pi launch path, and preserve explicit terminal surfaces.
- No repository source change can satisfy the requested outcome until the external control exists.

## Implementation phase

1. Verify an Orca default-terminal setting or add and test CLI/API terminal suppression outside this repository. Gate: disposable-worktree integration tests prove the scenarios above.
2. Update this repository’s handoff skill in one change: revise step 4 and the `--agent`/`orca agent launch` prohibition if the selected launch path requires it; use the external control; start Pi through the selected surface; and revise retry, completion, and reporting contracts. Gate: existing offline skill checks plus the Orca integration test pass.

## Decision

Do not alter `skills/agent/handoff/SKILL.md` now. A partial change would only remove the second terminal and would not deliver the requested behavior.
