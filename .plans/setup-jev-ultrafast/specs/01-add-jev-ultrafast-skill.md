# Add the Jev Ultrafast Skill

## Objective

Add one portable operational skill for the pinned `browser-use/jev-ultrafast` browser agent. Keep executable code upstream; do not create a standalone clone, vendor the package, or add Python tool management to `install.sh`.

## Implementation

- [x] Create `skills/tools/jev-ultrafast/SKILL.md` with frontmatter name `jev-ultrafast`, an outcome-first `Use when ...` description, and standard invocation flags.
- [x] Record upstream version `0.1.0`, commit `1231850a0bf1a0c0341fe408ef1668dbbfdfac46`, and MIT provenance.
- [x] Define preflight for Python 3.12+, `uv`, Chrome, Browser Harness connectivity, `TYPESAFE_API_KEY`, and conditional `TEXT_MODEL_API_KEY` use.
- [x] Define immutable `uv tool install` setup that does not clone into the target repository, plus update and uninstall commands that use the same tool manager.
- [x] Document interactive `jev` inspector use and scripted `jev_ultrafast.Agent` use with independent outcome verification.
- [x] State credential, loopback-server, paid-call, browser-action, and unsupported-browser-feature safety boundaries.
- [x] Add the skill to the README Tools catalog using the exact frontmatter description and upstream provenance.

## Test Scenarios

- [x] **Pinned package starts:** Given an isolated tool directory and the pinned upstream Git commit, when the package is installed and `jev` starts on a private loopback port, then `/api/state` returns the idle application state and the inspector page identifies Jev Ultrafast.
- [x] **Skill installs through repository workflow:** Given a private HOME with a supported harness directory, when `install.sh` runs twice, then the harness skill path resolves to `skills/tools/jev-ultrafast` and the second run reports the existing link without destructive changes.
- [x] **Missing paid credentials remain safe:** Given no TypeSafe or text-model keys, when the local server smoke scenario runs without creating an agent, then no paid model request or browser action occurs and the server still reports idle state.

## Risk Controls

- Pin the Git commit; do not use `main` or an unbounded package version.
- Never print, copy, or commit credential values.
- Bind the inspector to upstream's loopback-only default; do not expose it to the network.
- Run installation and smoke verification under a newly created private temporary workspace and remove it afterward.
- Treat `DONE` as a model decision, not proof of task success; verify the page outcome separately.

## Out of Scope

- Vendoring or modifying upstream Python code.
- Adding a Python-tool manifest or automatic Jev Ultrafast executable installation to `install.sh`.
- Changing the existing `pi-jev` extension, `typesafe-ai` skill, or repository credential installer.
- Running a paid model-driven browser task without configured user credentials.
