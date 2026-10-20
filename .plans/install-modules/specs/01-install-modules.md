# Slice 01 — unified installer, root tools CLI and advice

Current revision is implemented and locally validated on `install-modules`, base `3720046`. Sources: [proposal](../proposal.md), [discovery](../discovery.md), [CLI plan](../cli-plan.md).
Default installation/status behavior remains. Latest user changes authorize missing-tool advice and revised help/diagnostic text.
Reviewer acceptance remains open.

## Implementation

- [x] Consume the external safe baseline. Keep original streams, statuses, bytes, modes, links and rerun evidence outside git. Never use real HOME or live packages.
- [x] Keep `install/modules/patches.sh` definition-only with both engines and all five adapters. Do not change patch contents or package versions.
- [x] Source that module directly from `harness/pi/tests/package-patches.test.sh`. Preserve every assertion.
- [x] Keep artifact collectors, linker, destination/glob handling, counters, stale cleanup and summaries in `install/modules/artifacts.sh`. Preserve process substitutions, shared state and return behavior.
- [x] Keep managed-file copying in `install/modules/config.sh`. Preserve top-level exclusions, executable handling and status categories.
- [x] Keep Pi hoist/reset, vendor manifests, secrets/environment, CLI links and checkout recording in `install/modules/pi.sh`. Preserve skip policy, permissions and global umask.
- [x] Keep OMP profile status, plugins and bun fallback in `install/modules/omp.sh`. Preserve RETURN cleanup and immediate failure.
- [x] Update `install/modules/tools.sh` to use internal `--check-status`. Suggest exactly one shell-safe root `--tools` command only when tools are missing. Do not add hardcoded tool examples or fail default root because of missing tools.
- [x] Keep bootstrap, registry/order, shared `REPO_ROOT`, `PI_AGENT_DIR`, `PATCH_FAILED` and deferred final failure in `install/main.sh`. Load environment before registry/helpers.
- [x] Keep root `install.sh` thin and its `install_main "$@"` call unconditional. Do not wrap the lifecycle in `if`, `!`, OR-lists or a new subshell.
- [x] Use own-`BASH_SOURCE` anchors. Main uses `..`, the tools bridge uses `../tools`, and tests use `../..`. Preserve git-root/caller-PWD fallback and common-checkout recording.
- [x] Preserve tracked tool moves and executable modes. Limit adapter changes to requested help/advice. Keep package-install commands and control flow unchanged.
- [x] Keep one authoritative master registry and normalization. Share literal validation between internal install, help and `--validate TOOL`. Validation must not call adapters or inspect installed state.
- [x] Parse only no args, sole `--help`, `--tools`, or `--tool TOOL` before bootstrap. Reject obsolete flags, malformed/conflicting actions and unknown/regex-like names with status 1 on stderr. Help returns 0 without effects.
- [x] Run explicit actions after normal work/Pi postlude and before reporting. Preserve environment, original operand, separate streams and selected/aggregate failure status. Deferred patch status 1 takes precedence. Immediate repository failure stops before tools.
- [x] Use `git mv` for the guide to `install/TOOL_INSTALLATION.md`. Update every current guide link. Record the explicit exception: main is the only runtime file at install root, alongside this document.
- [x] Audit all tracked user-facing installation references, including global skills. Recommend root `./install.sh --tools` or `./install.sh --tool TOOL` with CWD clear. Preserve unrelated tool namespaces and prerequisites.
- [x] Update root README, AGENTS layout, tools README, guide and current planning. Promote root installation, not internal commands. Leave the parent-owned plan README untouched.
- [x] Extend the existing offline regression without a new framework. Run twice. Cover strict/obsolete flags, no-effect preflight, action order, aliases, skip forwarding, streams, failure precedence, advice quoting and guide structure. Use only recording adapters for installation.
- [x] Add internal `--check-status` through the existing report counter. Preserve direct `--check` status 0. Missing non-skipped tools return 1 internally, present/skipped return 0. Keep existing repeated probes, with no third check or output parsing.
- [x] Keep definitions/tools/tests in their subdirectories. Only `main.sh` and the guide are direct files under `install/`. Remove empty obsolete source directories. Do not add shims.
- [x] Run the external verifier copy with fresh safe fixtures. Preserve assertions, isolation and normalization. Inspect and record every requested output difference, not only relocated paths.
- [x] Run `bash -n` on every changed shell and the regression/patch tests. Run ShellCheck if available. Run the patch test directly.
- [x] Run the required extension test with safe copied SDK/package fixtures through the verifier. Retain every assertion and record all five patches as patched, then ok.
- [x] Audit references, modes, renames, protected content and working/cached `git diff --check`. Distinguish executable internals and historical evidence from user instructions.
- [x] Record exact commands, results, differences, source stats and limits in [implementation.md](../implementation.md). Do not commit, push, publish or create branches/worktrees.

## Test Scenarios

1. **Fresh parity.** Equivalent no-argument fixtures preserve statuses, files, modes, links and operation order. Requested advice/help/prerequisite text differences remain visible in exact comparison.
2. **Rerun states.** Fresh, changed-copy, wrong-link, real-path and dangling-link fixtures preserve ok/copy/update/link/repoint/overwrite categories and cleanup. Reruns do not add operations.
3. **Harnesses and profiles.** Directory/binary detection, absent harnesses, zero/one/multiple profiles, literal destinations and unmatched globs preserve behavior and dispatch order.
4. **Bootstrap.** Missing/file/inherited keys and custom Pi directory preserve key/export precedence, post-bootstrap registry, secret mode 600, Jev config mode 644 and process umask. Keys are not logged.
5. **Imports.** Main and definition imports do not load `.env`, install files, emit output, mutate HOME or alter import-time umask/traps. Functions become available as designed.
6. **Patch safety.** First apply reports patched, rerun ok, missing packages skip, mismatches fail unchanged and failed later hunks leave bytes unchanged.
7. **Repository failures.** Patch/vendor failures defer through unrelated work/postlude/report to original status 1. Native OMP failure still aborts immediately. Inspect separate streams.
8. **Paths.** Absolute/relative invocation outside CWD and source paths with spaces work. Preserve common-checkout recording and non-git caller-PWD fallback. Do not invent a different root policy.
9. **Root preflight.** Help is sole and side-effect-free. Unknown, obsolete, empty/missing, extra, repeated/conflicting and regex-like inputs fail before `.env`, git, checks or writes. Errors use stderr and status 1.
10. **Internal compatibility.** Existing master/adapter flags remain supported internally. Preserve aliases, substring skips, repeated checks, counters, tool-help fallback and direct `--check` status 0. Literal validation rejects regex-like names.
11. **Provisioning.** Preserve hoist skip/reset/ok, vendor pin/update/unsafe/occupied/failure paths, native bun, npx fallback and cleanup. No real package store or network is touched by tests.
12. **Extension safety.** Safe SDK/package tests retain write/edit/apply_patch registration and widget denial assertions. No version or assertion changes make the test pass.
13. **Structure.** Root remains thin. Main, six definitions, tools and tests have cohesive owners. The guide is the only documentation exception at install root. No obsolete source trees or shims remain.
14. **Explicit tools.** `--tools` and `--tool gh`/`gh_stack` run after normal work/Pi postlude, before one report. Preserve order and environment. Existing skip rules do not cancel an explicit selection. All test installs use recording adapters.
15. **Explicit failure.** Selected status 9 propagates after reporting. Aggregate failure returns 1. Patch failure retains final status 1 when installation succeeds or fails. Immediate OMP failure prevents external installs/checks. Validation never invokes adapters.
16. **Missing advice.** Some missing tools add exactly one shell-safe root command and keep default status 0. Present/all-skipped add none. Strict/direct report output matches, statuses differ as designed, and probe counts remain unchanged. Advice works outside CWD with spaces.
17. **Public references.** Guide, root/tools README, skill installation sections, help and bridge advice use root installation commands. Guide links resolve after the move. Unrelated prerequisites, skill namespaces and runtime package implementations remain intact.

## Risk Controls and Scope

Keep real HOME, secrets, machine `.env`, installed packages, caches and package stores untouched.
Use isolated fixtures, a utility allowlist and no network/privileged installation.
Preserve shell conditional context, process substitutions, global umask, cleanup and deferred versus immediate failures.
Do not normalize away messages, ordering, modes, streams or statuses. Current reporting differences require inspection, not baseline rewriting.
No package upgrades, patch changes, unrelated tool fixes, new CLI aliases, duplicate registries, generic protocols or extra probes.
Test Scenarios are reviewer-owned requirements, not checked acceptance claims.

## Decisions and Status

The latest user revision replaces earlier long flag spellings with `--tools` and `--tool TOOL` without aliases.
It moves the guide directly under `install/`, overriding the earlier only-main-file rule for this document.
It also authorizes reliable missing-tool suggestions while preserving direct `--check` status and default root success.
Internal `--check-status` is the chosen minimal status channel. It reuses the existing report/counter without a third probe.

Open product questions: **0**. All 26 Implementation items were checked after fresh validation. All 17 Test Scenarios remain unaccepted.
Anthropic review remains quota-blocked. No cross-provider review is claimed. The parent owns the plan README and acceptance.
