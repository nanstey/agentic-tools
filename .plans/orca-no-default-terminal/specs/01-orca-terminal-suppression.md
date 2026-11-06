# Slice 01: Orca terminal suppression dependency

## Objective

Provide a verified Orca setting or `worktree create` option that prevents its implicit first terminal while retaining explicitly requested terminal and agent surfaces.

## Implementation

- [ ] Verify an Orca default-terminal setting or add the terminal-suppression option outside this repository.
- [ ] Update `skills/agent/handoff/SKILL.md` to use the external control and select a replacement Pi launch path.
- [ ] Revise step 4 and the `--agent`/`orca agent launch` prohibition if the selected launch path requires it.
- [ ] Revise the handoff skill’s terminal-list retry guard, completion condition, and output contract for the selected launch handle.
- [ ] Preserve explicit `--surface terminal` and explicit terminal creation requests.

## Test Scenarios

- [ ] Given no terminal request, when a disposable worktree is created, then `orca terminal list --worktree ... --json` reports no terminal.
- [ ] Given `--surface chat`, when an agent starts, then the launch result is chat and `orca terminal list --worktree ... --json` lists no terminal.
- [ ] Given `--surface terminal`, when an agent starts, then the launch result is terminal.
- [ ] Given chat is unavailable, when Orca falls back to a terminal, then the launch receipt reports the fallback and the terminal is listed.

## Validation

- `bash install/tests/skill-links.test.sh`
- `bash install/tests/agent-drift.test.sh`
- `bash install/tests/install.test.sh`
- Orca disposable-worktree integration test after the external CLI/API change.

## Risk controls

Do not claim suppression by merely removing, closing, or reusing the handoff skill’s terminal. Confirm the implicit-terminal behavior from Orca’s terminal list and launch receipt.

## Out of scope

Changing Orca itself from this repository.
