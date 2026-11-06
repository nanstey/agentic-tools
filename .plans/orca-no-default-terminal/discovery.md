# Discovery: Orca worktree terminal default

## Scope

Trace the repository handoff path that creates a fresh Orca worktree and starts Pi. Determine whether this repository can prevent a terminal from opening unless requested.

## Evidence

1. [`skills/agent/handoff/SKILL.md`](../../skills/agent/handoff/SKILL.md) is the relevant repository workflow. Its step 4 runs `ORCA worktree create ... --no-parent --json` without `--agent`. Its step 6 then always runs `ORCA terminal create ... --command 'pi ...'`. Its safety rules prohibit `--agent` and `orca agent launch`, and its completion/report contracts are terminal-handle based.
2. The version-matched Orca CLI guide, loaded through the resolved Orca command, states that `--agent` uses the user’s Chat | CLI preference and `--surface chat|terminal` overrides it for one launch. It also says that repo setup or default-terminal settings may add tabs or splits.
3. Executed `orca worktree create --help` states: “By default this creates the worktree and its first terminal.” It has no `--no-terminal` or equivalent option. Executed `orca repo show --repo id:<skills-repo> --json` exposes only hook and external-worktree-visibility settings for this repository, not a default-terminal control. Whether an Orca global setting can suppress the first terminal is unverified.
4. The handoff skill independently creates a second terminal. That is repository-controlled, but removing it cannot satisfy the requested terminal-free worktree creation while Orca still creates its first terminal.
5. `skills/dev/git/references/worktree.md` creates worktrees but starts no agent. `harness/pi/bin/pi-improve` creates a terminal only for its separate, explicit worker workflow. Neither controls the handoff default.
6. Existing offline tests are `install/tests/install.test.sh`, `install/tests/skill-links.test.sh`, and `install/tests/agent-drift.test.sh`. No test exercises Orca handoff behavior. The baseline installer test passed: `bash install/tests/install.test.sh`.

## Conclusion

The requested outcome is blocked in this repository. The CLI has no terminal-suppression option, and the target repository’s registered settings expose no such control. An Orca global default-terminal setting remains an unverified external possibility. Closing or reusing the implicit terminal after creation does not meet the requirement because the terminal has already opened.

The handoff skill also creates a separate Pi terminal. Removing it alone would not deliver the requested behavior and would leave the handoff without its current Pi session, terminal-based retry guard, completion condition, and report contract.

## Smallest actionable alternative

First determine whether Orca has a documented global default-terminal setting that suppresses the implicit first terminal. If it does not, add an Orca capability such as `worktree create --no-terminal`. It must compose with agent launch surfaces:

- no agent and no explicit terminal request: create the worktree with no terminal;
- `--agent ... --surface chat`: verify that the launch is chat and that no terminal is created;
- `--agent ... --surface terminal` or explicit `terminal create`: retain terminal startup;
- an agent fallback to terminal must be reported in the launch receipt.

After either external control exists, redesign `skills/agent/handoff/SKILL.md` as one change: select the appropriate session launch path, preserve explicit terminal startup, replace its terminal-list retry guard as needed, and update the completion and output contracts from terminal handle to launch outcome/handle. Add a disposable-worktree integration test that asserts the terminal list and launch receipt for every scenario.
