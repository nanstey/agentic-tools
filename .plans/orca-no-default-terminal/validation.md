# Validation

Executed on 2026-11-06:

```text
bash install/tests/install.test.sh
ok: root help and strict errors precede bootstrap, env, git, checks and writes
ok: all definition modules import without installation, env, umask or trap changes
ok: fresh/rerun artifacts, configs, profiles, secret permissions and npx cleanup
ok: env precedence/override, same-shell umask, no-arg paths and common-dir lookup
ok: deferred patch/vendor failures, immediate OMP errexit and bun/npx/missing-runtime paths
ok: pnpm skip/reset/rerun and pinned vendor clone/ok/update/unsafe paths use only stubs
ok: durable dependency stamp installs once per metadata hash and links the CLI
ok: master validation/help/errors, root-directed adapter help, literal names and probe counts
ok: missing tools preserve success and add one quoted root command, skipped/present tools add none
ok: root default/all/selected ordering, env forwarding, separate streams and failure precedence

bash install/tests/skill-links.test.sh
ok: 296 skill Markdown files keep relative links within their skill roots

bash install/tests/agent-drift.test.sh
ok: 24 agent tiers match bodies, model table, and README catalog

git diff --check
ok
```

Read-only Orca evidence:

```text
orca worktree create --help
By default this creates the worktree and its first terminal.
# No --no-terminal option is listed.

orca repo show --repo id:<skills-repo> --json
# The target repository exposes hookSettings and externalWorktreeVisibility only.
# No default-terminal control is returned.
```

No disposable worktree was created because this repository cannot validate the required behavior without an external setting or CLI/API capability.
