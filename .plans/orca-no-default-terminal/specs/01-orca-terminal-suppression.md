# Slice 01: Handoff terminal reuse and terminal-suppression dependency

## Objective

Reuse the one implicit terminal that Orca creates for a fresh handoff worktree so Pi does not need a second terminal. Keep terminal-free worktree creation as an external Orca dependency.

## Delivered implementation

- [x] Update `skills/agent/handoff/SKILL.md` to create the worktree without `--agent` and preserve the prohibition on `--agent` and `orca agent launch`.
- [x] List terminals for the new worktree, screen-read the candidate, and select it only when exactly one row has a handle, no `agentIdentity`, and an idle shell.
- [x] Start Pi with `terminal send` on the selected initial terminal, without calling `terminal create`.
- [x] Define safe failure for terminal-list ambiguity rather than sending Pi to an arbitrary terminal.
- [x] Complete and report on input acceptance, not terminal creation.
- [x] Use `terminal send`'s documented `--retry-request` replay only after an ambiguous transport failure, and never resend after `accepted: true`.
- [x] Preserve explicit terminal and agent requests outside this handoff.

## Remaining external dependency

- [ ] Verify an Orca default-terminal setting or add a `worktree create` option that prevents its implicit first terminal.
- [ ] Add disposable-worktree integration coverage for terminal-free creation, chat launch, explicit terminal launch, and chat-to-terminal fallback.

## Test scenarios

- [x] The skill requires exact-one selection of the fresh worktree's terminal and uses `terminal send`; no `terminal create` remains in its workflow.
- [x] The skill stops on terminal-list or screen-read errors, no eligible terminal, multiple terminals, or a non-idle shell.
- [x] The skill makes idempotent request replay the only retry after ambiguous send failure.
- [ ] Given no terminal request, when a disposable worktree is created, then `orca terminal list --worktree ... --json` reports no terminal.
- [ ] Given `--surface chat`, when an agent starts, then the launch result is chat and `orca terminal list --worktree ... --json` lists no terminal.
- [ ] Given `--surface terminal`, when an agent starts, then the launch result is terminal.
- [ ] Given chat is unavailable, when Orca falls back to a terminal, then the launch receipt reports the fallback and the terminal is listed.

## Validation

- `bash install/tests/skill-links.test.sh`
- `bash install/tests/agent-drift.test.sh`
- `git diff --check`
- Orca disposable-worktree integration test after the external CLI/API change.

## Risk controls

Do not claim terminal-free creation by reusing the handoff terminal. Do not create, close, or arbitrarily select a terminal during the handoff. A send receipt with `accepted: true` is not evidence of a started Pi turn, but it is the documented input-acceptance condition and must not be resent.

## Out of scope

Changing Orca itself from this repository.
