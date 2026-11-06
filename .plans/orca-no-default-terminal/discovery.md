# Discovery: Orca worktree terminal default and handoff reuse

## Scope

Trace the repository handoff path that creates a fresh Orca worktree and starts Pi. Determine whether this repository can prevent a terminal from opening unless requested, and whether it can avoid creating an additional Pi terminal safely.

## Evidence

1. [`skills/agent/handoff/SKILL.md`](../../skills/agent/handoff/SKILL.md) creates a worktree with `ORCA worktree create ... --no-parent --json` and omits `--agent`.
2. The version-matched Orca CLI guide says `worktree create` creates the worktree and its first terminal by default. Its `terminal create` command makes a terminal for shells and commands.
3. Executed `orca worktree create --help` states: “By default this creates the worktree and its first terminal.” It has no `--no-terminal` or equivalent option. Executed `orca repo show --repo id:<skills-repo> --json` exposes only hook and external-worktree-visibility settings for this repository, not a default-terminal control. Whether an Orca global setting can suppress the first terminal is unverified.
4. The version-matched guide documents `ORCA terminal list --worktree path:<worktree-path> --json`; terminal rows expose a handle and may expose `agentIdentity`. It says not to match a terminal title, to use `terminal read --screen` when the current terminal frame matters, and that setup or default-terminal settings can add tabs or splits.
5. The version-matched guide documents `ORCA terminal send --terminal <handle> --text <text> --enter --wait-submit <seconds> --json`. `accepted: true` proves input acceptance, not a started turn. A `--wait-submit` timeout does not resend. After an ambiguous transport failure, retry the exact command with its `--retry-request <id>`; the request is bound to the payload and terminal process incarnation.
6. The previous handoff workflow independently created a second terminal for Pi. Reusing the initial terminal removes that repository-controlled extra terminal but cannot make worktree creation terminal-free.
7. `skills/dev/git/references/worktree.md` creates worktrees but starts no agent. `harness/pi/bin/pi-improve` creates a terminal only for its separate, explicit worker workflow. Neither controls the handoff default.
8. Existing offline tests are `install/tests/install.test.sh`, `install/tests/skill-links.test.sh`, and `install/tests/agent-drift.test.sh`. No test exercises Orca handoff behavior.

## Conclusion

The original terminal-free outcome remains blocked: the CLI has no terminal-suppression option, and the target repository’s registered settings expose no such control. Closing or reusing the implicit terminal does not make it terminal-free because the terminal has already opened.

The approved interim outcome is repository-controlled and delivered by the handoff skill: after creating a worktree without `--agent`, it selects the initial terminal only if there is exactly one terminal row with a handle and no `agentIdentity`, and its screen shows an idle shell, then sends the Pi launch command to it. Any list or screen-read failure, ambiguity, or non-idle shell stops the handoff without starting Pi. An accepted send is not resent; an ambiguous transport failure can only use the documented idempotent `--retry-request` replay on that exact terminal.

## Remaining external dependency

Determine whether Orca has a documented global default-terminal setting that suppresses the implicit first terminal. If not, add an Orca capability such as `worktree create --no-terminal`. It must compose with agent launch surfaces:

- no agent and no explicit terminal request: create the worktree with no terminal;
- `--agent ... --surface chat`: verify that the launch is chat and that no terminal is created;
- `--agent ... --surface terminal` or explicit `terminal create`: retain terminal startup;
- an agent fallback to terminal must be reported in the launch receipt.

A future change for that external capability must add disposable-worktree integration coverage for each scenario. It must not regress the current handoff behavior or change explicit terminal and agent requests outside the handoff.
