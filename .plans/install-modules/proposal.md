# Modular installer and explicit tool installation

One PR slice on `install-modules`, based on `3720046`. This proposal defines the current layout. [discovery.md](discovery.md) records source evidence. [implementation.md](implementation.md) records execution and validation.

## Purpose

**Goal:** make installer changes local to cohesive modules. Preserve default installation and success policy. Add explicit tools actions and requested missing-tool advice. **Reality:** the 574-line root script combines bootstrap, artifact transport, two harness integrations, upstream patches, and tool checks. **Options:** retain the monolith, split every function into a file, or extract stable responsibility groups. Choose one repository-root `install/` directory and a thin root entrypoint. Keep `main.sh` as the only runtime file directly under `install/`. The moved `install/TOOL_INSTALLATION.md` guide is the documentation exception. Put definitions in `install/modules/`, external tools in `install/tools/`, and tests in `install/tests/`. Reject a dispatch-framework rewrite and tiny single-function modules: both add change without improving this slice's compatibility guarantee.

## User story & scenarios

As a maintainer, I can change one installer responsibility without navigating unrelated integrations. As an operator, I still run `bash install.sh`, get the same ordered actions and reports, and rerun it safely. Direct external-tool commands use `install/tools/`. Add side-effect-free validation and reject regex-like names. Preserve other direct CLI behavior.

The current [CLI plan](cli-plan.md) uses root `--tools`, `--tool TOOL` and `--help`. Default installation remains check-only for external tools. Every user-facing tool installation reference uses root.

## Behaviour

| Given | When | Then |
| --- | --- | --- |
| The same isolated environment and no arguments | Old and modular root installers run from equivalent fixtures | Files, modes, status and operation order match. Output permits the requested root advice, prerequisite text and root-promoting help changes. Retain and inspect every difference. |
| A previously installed fixture | The modular installer runs again | Existing ok/copy/update/link/repoint/overwrite categories and cleanup match baseline; no new resets or package installs occur. |
| A required patch/vendor operation fails | Harness installation proceeds | Existing deferred-failure policy remains: unrelated operations and tool checks run, then the same final error/status occurs. OMP native installation failures retain immediate errexit behavior. |
| A shell outside the checkout or an isolated linked worktree | The root is invoked by its filesystem path | Modules resolve relative locations from their own `BASH_SOURCE`; existing git-root and non-git PWD fallback policy is preserved. |
| Root `--help` or invalid arguments/names | Root parses before bootstrap | Help prints usage and returns 0. Errors use stderr and return 1. Neither runs `.env`, git, checks or installation. |
| Root `--tools` or `--tool TOOL` | Normal repository work and Pi postlude finish | Root installs all or one tool through the master CLI, then runs the existing status report. Environment and separate output streams pass through. |
| An explicit tool install fails | Root reports status afterward | Selected failure status propagates. All-tool failure returns 1. Deferred patch failure still determines status 1. Immediate repository failure stops before tool installation. |
| Direct master options and names | The corresponding entrypoint runs | Existing install actions remain internal. Direct `--check` still returns 0 for missing tools. Add validation and internal `--check-status`. |
| Missing, present or skipped tools | Root reports status | Suggest one shell-safe root `--tools` command only for non-skipped missing tools. Do not change default success or add probes. |
| No API key, an inherited key, or fixture `.env` | Bootstrap and definition-module imports are exercised | Existing key precedence, export timing, Pi override and permissions remain; sourcing patch definitions never loads secrets or runs installation. |

## QA

Use the baseline worker's temporary fixtures. Do not run the installer against real HOME. Keep focused offline assertions at `install/tests/install.test.sh`. Use the external verifier for exact output, status, file, mode, link and rerun comparisons. Adapt a copy of that verifier outside git to detect `install/tools/`. Keep its isolation, assertions and normalization unchanged. Inspect every difference, including requested help, advice and prerequisite-message changes. Do not normalize them away. Do not add source-path shims or duplicate dependency trees in git. Run focused regression tests twice. Use recording adapters for every explicit install. Check root help/error side effects, ordered actions, separate streams and failure precedence. Do not claim new CLI assertions pass the original ignored-argument installer.

Required gates:

- `bash -n` on each of `install.sh`, `install/main.sh`, `install/modules/*.sh`, `install/tests/*.sh`, `install/tools/*.sh` and the patch test.
- `bash install/tests/install.test.sh` for compatibility scenarios, with no network or host package changes.
- `bash harness/pi/tests/package-patches.test.sh`; replace its root-text awk extraction with direct source of the definition-only patch module, retaining every assertion.
- `node harness/pi/tests/package-extensions.test.mjs <fixture-sdk-dir> <fixture-agent-dir>` using the baseline worker's safe prepared SDK/package fixtures. Preserve test assertions and pinned dependencies; do not install or patch live packages to make the gate pass.
- Targeted tracked-file search for old script-directory references and a review of rename detection/modes. `skills/tools/`, companion-skill links and ordinary prose/regex occurrences remain untouched.

Use [implementation.md](implementation.md) for executed results and coverage limits. Keep every Test Scenario open for reviewer acceptance.

## Architecture

Root retains the shebang and strict mode. It resolves `install/main.sh` from its own `BASH_SOURCE` and calls `install_main "$@"` outside a conditional context. Main owns early argument parsing, bootstrap, the existing registry/dispatch, and final status. It parses before REPO_ROOT, `.env` or helper loading. Single-tool preflight runs the master child with `--validate`. Root has no separate tool registry. Main loads six definition modules after bootstrap.

| File under `install/` | Responsibility |
| --- | --- |
| `main.sh` | Strict root CLI, early validation, bootstrap, registry, ordered orchestration, explicit tool dispatch and failure status. |
| `modules/artifacts.sh` | Frontmatter collectors, link operation, artifact destination expansion/tallies/stale cleanup. |
| `modules/config.sh` | Top-level managed-file copy and summary. |
| `modules/pi.sh` | pnpm hoist, vendor clones, secret/environment setup, CLI links and self-improvement checkout record. |
| `modules/patches.sh` | Literal/unified patch engines and package-specific adapters. |
| `modules/omp.sh` | Native plugin handling, temporary bun fallback and profile status-line application. |
| `modules/tools.sh` | Internal status-report bridge and shell-safe root installation advice. |

Only `main.sh` and the documentation exception `TOOL_INSTALLATION.md` are files directly under `install/`. Definitions, tools and tests keep their subdirectories. Remove the empty `src/` tree.

Keep the current function names and explicit shared `REPO_ROOT`, `PI_AGENT_DIR`, `PATCH_FAILED` context. Main derives the legacy root locator's anchor from its own `..`, preserving git-root/PWD fallback. Path-owning modules use their own `BASH_SOURCE`, not `$0` or assumed CWD. The tools bridge resolves `../tools` from `install/modules/`. Definition modules do not perform installation, load `.env`, or mutate HOME on source. Registry expansion still follows environment loading. Pi CLI links depend on artifact `link_one`; patch adapters share local engines. No plugin registration abstraction or universal utility module.

Keep extraction in the same shell: no new subshells around lifecycle/orchestration, no accidental errexit suppression, and no changed global umask or trap behavior. Preserve command placement and return codes when extracting the artifact block.

Preserve tracked tool moves and modes. Adapter help and diagnostic advice may change to promote root installation. Keep package-install commands and control flow unchanged. The master adds shared validation and internal missing-status reporting. Preserve existing skip rules, counters and probe count. Do not add an old-path shim.

Direct `--check` keeps status 0. Internal `--check-status` calls the same report with a strict flag and returns 1 when its missing counter is positive. The bridge uses that status, not parsed output. Skipped tools do not increment missing. Root prints one quoted root command for missing tools and remains successful.

Run explicit tool installation after the Pi postlude, before the existing check bridge. Capture only the child command's failure. Do not wrap the main lifecycle in a conditional. Keep child stdout/stderr separate. Run the check even after explicit tool failure. Preserve deferred patch status 1 before returning the saved tool status.

## Affected areas

- Thin `install.sh`, `install/main.sh`, six definition modules in `install/modules/`, and `install/tests/install.test.sh`.
- `tools/*` renamed to `install/tools/*` with `git mv`. Add master `--validate TOOL` and shared literal validation. Update usage documentation.
- `harness/pi/tests/package-patches.test.sh` import adapted; extension smoke assertions unchanged.
- `git mv TOOL_INSTALLATION.md install/TOOL_INSTALLATION.md`. Update guide links, root examples, adapter/master help and managed-tool installation instructions across global skills.
- Brief implementation-layout guidance in root `README.md` / `AGENTS.md` as needed; no catalog row changes and no new harness-managed files.
- Parent owns `.plans/install-modules/README.md`; this task does not edit it.

## Implementation phases

**Slice 01 — one independently reviewed PR:** extract modules, move tools, update path consumers and test imports, add compatibility coverage. These changes ship together because the root bridge, relocated scripts, docs, and source-coupled test must agree atomically. Within the slice, start with the definition-only patch module/test seam, then move the remaining responsibility groups, then relocate tools/references and finish parity coverage. Gate: every QA check above passes with reviewed baseline parity and no unapproved source/dependency/runtime behavior changes. Checklist: [specs/01-install-modules.md](specs/01-install-modules.md).

## Decisions and review status

**2026-10-20 layout decision:** the user replaces the split `src/install/` and `src/tools/` layout with one repository-root `install/` directory. Main remains the only runtime file at its root. The later guide move is the explicit documentation exception. Definition modules, external tools and tests keep separate subdirectories. The check-only bridge remains separate from the external tools CLI. This decision changes paths, not runtime behavior.

**2026-10-20 current CLI/document decision:** use `--tools` and `--tool TOOL`, without obsolete aliases. Move the guide directly under `install/`. Promote root installation everywhere, including global skills and help. Preserve default success but add reliable missing-tool advice through internal `--check-status`. Requested reporting text now differs from the original baseline. Shared literal validation remains required. No package-install redesign is included.

Open product questions: **0**. Preserve one-PR scope. The earlier plan review predates these revisions. Anthropic cross-provider review remains quota-blocked and is not claimed. The parent owns the plan README and reviewer acceptance.
