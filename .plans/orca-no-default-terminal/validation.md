# Validation

Executed after implementation on 2026-11-06:

```text
bash install/tests/skill-links.test.sh
ok: 296 skill Markdown files keep relative links within their skill roots

bash install/tests/agent-drift.test.sh
ok: 24 agent tiers match bodies, model table, and README catalog

git diff --check
ok

static handoff assertions
ok: handoff has one safe launch command, observable idle-shell gate, and replay-only retry
```

Reproduce that static validation from the repository root:

```bash
python3 - <<'PY'
from pathlib import Path

skill = Path("skills/agent/handoff/SKILL.md").read_text()
required = (
    "exactly one terminal row with a nonempty `handle` and no `agentIdentity`",
    "`result.terminal.source` is `screen`",
    "`result.terminal.status` is `running`",
    "`result.terminal.draft` is absent or empty",
    "^[A-Za-z0-9][A-Za-z0-9._/-]*$",
    "launch_command=",
    "\\$(cat $brief_file)",
    '--text "$launch_command"',
    "--retry-request <id>",
)
missing = [item for item in required if item not in skill]
assert not missing, f"missing handoff safeguards: {missing}"
assert skill.count("launch_command=") == 1, "launch command must have one definition"
assert skill.count("--retry-request <id>") == 1, "retry rule must have one source"
assert "ORCA terminal create" not in skill, "handoff must not create a terminal"
print("ok: handoff has one safe launch command, observable idle-shell gate, and replay-only retry")
PY
```

The static assertion checks exact-one terminal selection, observable rendered-screen idle criteria, the safe single launch-command definition and use, replay-only retry, and the absence of `ORCA terminal create`.

Source-grounded Orca CLI evidence was read from the resolved CLI, `/home/noel/.config/orca/linux-orca-cli-shim/orca`, and its version-matched `orca-cli` guide:

```text
orca worktree create --help
By default this creates the worktree and its first terminal.
# No --no-terminal option is listed.

orca terminal send --help
Usage: orca terminal send [--terminal <handle>] [--text <text>] [--enter]
                          [--interrupt] [--wait-submit <seconds>]
                          [--retry-request <id>] [--json]

# An ambiguous transport failure must retry the exact command with its
# --retry-request ID. A --wait-submit timeout never resends.
```

No disposable worktree was created for this documentation-only change. The remaining terminal-free behavior cannot be validated until Orca provides a verified default-terminal setting or CLI/API capability. The existing baseline installer validation remains recorded in the prior plan history; it was not rerun because this change does not modify installer code.
