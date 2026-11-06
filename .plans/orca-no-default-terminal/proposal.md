# Proposal: reuse the implicit terminal while terminal suppression remains unavailable

## Purpose

A handoff creates a fresh Orca worktree and starts Pi. Orca creates the worktree's first terminal by default, and the handoff previously created a second terminal for Pi. The approved interim behavior is to reuse the first terminal safely. It does not satisfy the broader terminal-free requirement because Orca still opens that first terminal.

## Delivered behavior

1. The handoff keeps `ORCA worktree create ... --no-parent --json` and omits `--agent`.
2. After writing the self-contained brief, it lists terminals scoped to the new worktree and screen-reads the selected handle.
3. It selects the terminal only when exactly one row has a nonempty handle and no `agentIdentity`, and the screen confirms an idle shell. A listing or screen-read error, zero eligible rows, multiple rows, or a non-idle shell is a safe failure: the worktree remains, but Pi is not started.
4. It sends the Pi command through `ORCA terminal send --terminal <handle> --text <launch-command> --enter --wait-submit 10 --json`, rather than calling `terminal create`.
5. It completes on `accepted: true`. A submission-observation timeout after acceptance is not resent. An ambiguous transport failure may only replay the exact request with its reported `--retry-request`; all other send failures stop without a replacement terminal or fresh send.
6. Reporting identifies the reused terminal and input acceptance. It does not claim that Orca created no terminal.

## Still-unavailable behavior

The installed CLI documents a first terminal by default and has no `--no-terminal` option. The target repository’s registered settings expose no default-terminal control. These requested scenarios remain blocked until an Orca setting or CLI/API capability is verified:

1. Given no terminal request, when a disposable worktree is created, then no terminal opens.
2. Given a caller starts an agent with `--surface chat`, when Orca creates the worktree, then the launch outcome is chat and `orca terminal list` reports no terminal.
3. Given a caller explicitly requests `--surface terminal` or creates a terminal, when Orca starts the worktree or agent, then the terminal behavior remains available.
4. Given chat is unavailable after worktree creation, when Orca falls back to terminal, then the launch receipt explains that fallback.

## Architecture

The repository handoff controls only its additional Pi terminal. Reusing the implicit initial terminal removes that additional terminal and avoids `--agent`, `orca agent launch`, and `terminal create`. Exact-one selection avoids sending Pi into a setup, agent, or arbitrary terminal when repo settings add more tabs or splits. The terminal-free control point remains an Orca default-terminal setting or `worktree create` CLI/API capability outside this repository.

## Affected areas

- Delivered repository change: `skills/agent/handoff/SKILL.md`.
- Delivered planning and validation record: `.plans/orca-no-default-terminal/`.
- Remaining external dependency: Orca terminal-suppression capability and disposable-worktree integration coverage.

## Decision

Implement the approved optimization now. Do not characterize it as terminal-free worktree creation. Preserve Orca's initial terminal, explicit terminal and agent flows outside the handoff, CLI resolution, and the handoff's rule against `--agent` and `orca agent launch`.
