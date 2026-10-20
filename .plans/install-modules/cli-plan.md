# Installer CLI plan

## Current contract

The latest user revision uses root `--tools` and `--tool TOOL`. Earlier long flag spellings are obsolete and must fail preflight.
Use root `install.sh` for every user-facing tool installation command. Internal master and adapter interfaces remain compatible.

- No args: normal repository installation, then tool report. Do not install external tools automatically.
- `--tools`: normal installation, all tools, then report.
- `--tool TOOL`: normal installation, selected tool, then report. Preserve underscore aliases.
- Sole `--help`: usage on stdout, status 0, no bootstrap, `.env`, checks or writes.
- Reject malformed, unknown, repeated or conflicting arguments before bootstrap. Use status 1 and stderr.
- Preserve explicit failure propagation after reporting. Deferred patch failure still determines status 1. Immediate repository failures stop before tools.

## Layout

Root `install.sh` remains thin and calls `install_main` outside conditional context.
`install/main.sh` owns parsing and orchestration. Definitions, tools and tests retain their subdirectories.
Move the tracked guide with `git mv` to `install/TOOL_INSTALLATION.md`.
The guide is the latest explicit exception to the earlier main-only directory rule. Main remains the only runtime file directly under `install/`.
The parent owns `.plans/install-modules/README.md`.

## Internal interfaces

The master owns the registry and normalization. Root invokes `--validate TOOL` as a child before selected-tool bootstrap.
Literal membership rejects regex-like names. Keep direct master install flags and adapters supported internally.

Retain direct `--check` status 0 for missing tools. Add internal `--check-status` that calls the same `check_all` report in strict mode.
Strict mode returns 1 only when its existing non-skipped missing counter is positive. Skipped tools are not missing.
Do not duplicate the registry, parse human output, or run a third probe.

The bridge invokes `--check-status` under its existing conditional pipeline.
When tools are missing, print exactly one shell-safe root command ending in `--tools`.
All-present and all-skipped reports print no installation suggestion. Default root still returns 0 for missing tools.

## User-facing references

Promote only root `./install.sh --tools` and `./install.sh --tool TOOL`, with repository-root CWD explicit.
Update the moved guide, root README, tools README, help examples, bridge advice and global skills.
Replace manual install recommendations for the six managed CLIs. Preserve unrelated prerequisites, package implementations and tool namespaces.
Internal interface documentation may name direct options but must not recommend those commands for installation.

## Verification

- Run offline regression twice. Cover strict current/obsolete flags, empty HOME/`.env` preflight, action order, aliases, environment and separate streams.
- Cover selected status 9, aggregate failure, patch precedence and immediate OMP failure with recording adapters only.
- Cover missing/present/skipped reports, direct `--check` compatibility, strict status and exact probe counts.
- Verify the suggested command reconstructs a path containing spaces and points to root, not the internal master.
- Check the moved guide and the two allowed files at install root.
- Audit the full tracked repository and global skills for bypassing user installation instructions.
- Run syntax, required patch test, fixture-backed extension test, whitespace and rename/mode audits.
- Capture a fresh safe baseline comparison. Inspect all requested advice/help/prerequisite text differences without changing normalization.

No real HOME, secrets, installed packages, network installations, branches, worktrees, commits or publication are permitted.
Anthropic review is quota-blocked. Do not claim cross-provider review. Leave every Test Scenario unaccepted for the parent.
