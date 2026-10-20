# Installer extraction discovery

Discovery examines base `3720046` on `install-modules`. Source line references below describe that baseline, including its original `tools/` paths. Recommendations reflect the current layout. [implementation.md](implementation.md) records later execution and validation.

**2026-10-20 layout decision:** the user replaces the split `src/install/` and `src/tools/` design with repository-root `install/`. Keep `main.sh` as the only runtime file directly under `install/`. The later guide move is an explicit documentation exception. Put definitions in `modules/`, external tools in `tools/`, and tests in `tests/`. Keep the check-only bridge separate from the tools CLI. This decision changes paths only.

**2026-10-20 current CLI/document decision:** use root `--tools`, `--tool TOOL` and sole `--help`. Reject obsolete aliases. Move the guide to `install/TOOL_INSTALLATION.md` and promote root installation across docs, skills and help. Preserve default success but add missing-tool advice through internal `--check-status`. [cli-plan.md](cli-plan.md) defines the current contract.

## Files Retrieved

| File and lines | Why it matters |
| --- | --- |
| `AGENTS.md:1-119` | Ownership, symlink/copy contracts, catalog policy and durable Pi changes. |
| `install.sh:1-26` | Strict mode; git-root/PWD fallback; conditional `.env`; Pi override; ordered harness registry. |
| `install.sh:28-84` | Frontmatter collectors and idempotent config copies. |
| `install.sh:85-136` | OMP profile status application and pnpm hoist/store reset. |
| `install.sh:138-236` | Five patch adapters, literal engine and unified-diff engine. |
| `install.sh:238-295` | Pi CLI links, checkout record, shared secret and Jev environment configuration. |
| `install.sh:297-420` | OMP plugins/bun fallback and pinned vendor-git installation. |
| `install.sh:422-574` | Detection/linker, execution order, glob expansion, cleanup, summaries, tools and deferred failure. |
| `tools/install.sh:1-221` | Own-BASH_SOURCE locator; six-tool registry; CLI and skip behavior. |
| `tools/gh.sh:1-160`, `tools/gh-stack.sh:1-156` | OS-specific GitHub CLI and extension adapters. |
| `tools/playwright-cli.sh:1-102`, `tools/chrome-devtools-cli.sh:1-113`, `tools/agent-browser.sh:1-114`, `tools/orca.sh:1-134` | Independent prerequisite/check/install/dispatch differences. |
| `tools/README.md:1-213` | Tool-local versus root-relative examples and authoring instructions. |
| `TOOL_INSTALLATION.md:240-344,430-496` | Public tool interfaces and development examples; targeted search also finds old paths at lines 23-227. |
| `README.md:1-45`; targeted search `116-120` | Stable root invocation/harness contract; unrelated skills/tools catalog links. |
| `harness/pi/README.md:1-179` | Managed-file table, offline tests and patch contract. |
| `harness/omp/README.md:1-58` | Profile status and native plugin behavior. |
| `harness/pi/tests/package-patches.test.sh:1-33` | Root-function awk extraction must change to a module source. |
| `harness/pi/tests/package-extensions.test.mjs:1-63` | Real SDK load, diff tools and widget denial assertions. |
| `harness/pi/tests/pi-improve.test.sh:1-35`; targeted search `82-83` | Root syntax/entrypoint and two-run integration consumers. |
| `skills/tools/agent-browser/SKILL.md:30-53` | Actual moved-script consumer at line 44. |
| `.plans/install-modules/README.md:1-27` | Parent-owned index, one slice and safe-fixture decisions. |

## Key Code and Architecture

At the base commit, the root defines everything and executes it in one Bash process. Bootstrap (`install.sh:4-15`) loads `.env` with `set -a` only when `TYPESAFE_API_KEY` is empty, then selects `PI_AGENT_DIR`. Registry expansion follows (`17-26`). The prelude writes secrets/Jev environment; harnesses run Claude, Pi, OMP, Codex with unchanged pair order; the postlude links Pi CLIs, records the main checkout, checks tools, then evaluates accumulated failure (`445-574`).

Critical preservation details:

- The baseline root ignores arguments. The accepted CLI extension replaces that behavior. Parse the three root forms before bootstrap. Help and invalid inputs must not execute `.env`, git, checks or installation. Default installation/status behavior remains, except the requested advice and diagnostic text.
- Unified patches reverse-check before forward dry-run/apply; missing packages succeed and mismatches fail without partial changes (`217-236`). Literal patching is a separate concept (`151-177`).
- Patch/vendor failures accumulate via `|| PATCH_FAILED=1`; OMP plugin failures retain ordinary errexit (`473-500`). Never call extracted main through `if`, `!` or `||`, which can disable errexit internally.
- The secret operation changes process-wide `umask 077` (`267-279`). Preserve this, chmod behavior and shell/trap scope; no new lifecycle subshells.
- Link/copy category words feed counters; preserve sort/traversal/glob behavior, cleanup, streams and summaries (`34-83,433-443,508-538`).
- Baseline `check_all` returns 0 even with missing tools and probes each tool twice. This prevents the original bridge from showing missing-tool advice. Preserve direct `--check` status, substring skips and counters. Add internal `--check-status` using the same counter and probes. Only non-skipped missing tools make that mode return 1.
- Tool help embeds `$0`; relocating executables necessarily changes invocation paths. Baseline comparison now includes requested missing-tool advice, prerequisite text and root-promoting help differences. Inspect every change without broader normalization. Explicit flags intentionally add behavior outside the original root contract.

## DRY Findings

Depth: all root/tool shell files and relevant path consumers. No High findings.

### Low — D1: tool-name validation (true duplication)

Evidence: `tools/install.sh:156-164,171-179`. Both specific-install and tool-help normalize names, check the same registry and print identical invalid-name diagnostics. Severity **Low**; improvement value **Low**.

Recommendation: extract shared validation inside `install/tools/install.sh`. Keep the registry and normalization there. Compare normalized names with literal equality, not regex grep. Use the helper for direct install, tool help and new `--validate TOOL`. **Disposition: included for the accepted root preflight requirement.** Keep package-install control flow and other CLI quirks unchanged.

Notable non-findings:

- Root already shares frontmatter parsing, linking, copying and patching (`install.sh:29-31,57-64,151-177,217-236,433-443`). No generic helpers framework is needed.
- Repeated patch dispatch has explicit adapter and failure-policy value; do not redesign it into a new registry.
- Npm-based tool adapters differ in prerequisites, provisioning, warnings, checks and output. Similar syntax does not justify coupling them.
- Repeated runnable doc paths require atomic migration, not generated documentation.

## SRP Findings

### High — S1: divergent root-file responsibilities

Evidence: bootstrap/registry (`install.sh:4-26`), copy transport (`57-84`), patches (`138-236`), Pi lifecycle (`238-295`), OMP (`88-104,297-329,392-420`), vendor provisioning (`331-387`), linking (`433-443`) and tool bridge (`546-565`). Severity **Medium**; improvement value **High**.

Reasons to change differ: tool prerequisites, package upstream versions, harness manifests, environment persistence and artifact transport. Adapter comments and separate harness documentation demonstrate these pressures; no historical-churn claim is necessary. Extract stable responsibility groups, not one file per function.

### Medium — S2: orchestration embeds destination mechanics

Evidence: `install.sh:448-500` selects harness operations; `501-538` expands destinations, invokes collectors, tallies results, removes dangling links and renders summaries. Severity **Medium**; improvement value **Medium**.

Extract the contiguous artifact-destination operation into the artifact owner. Keep harness detection/type dispatch, order and deferred failure together. Avoid tiny handler functions or broad dispatch rewrites.

## Extraction Recommendations

Installer code belongs under repository-root `install/`, not installed harness content. Only `main.sh` and `TOOL_INSTALLATION.md` are files at the directory root. The guide is a documentation exception. Definitions use `install/modules/`. External tools and tests use `install/tools/` and `install/tests/`. Ranges below refer to the baseline `install.sh`.

| Destination | Extraction / interface | Placement rationale |
| --- | --- | --- |
| `install/main.sh` | Bootstrap/context and HARNESSES (`4-26`), `present` (`422-427`), orchestration (`445-544,567-574`); `install_main` | Owns initialization, harness policy/order and final status. Root becomes strict mode, own-path source and an unconditional main call. |
| `install/modules/artifacts.sh` | `fm_name`, collectors (`28-53`), `link_one` (`429-443`), artifact destination block (`501-538`) | Frontmatter-driven discovery/link transport, cleanup and reporting change together. Pi CLI links reuse `link_one`. |
| `install/modules/config.sh` | `copy_one`, `install_config` (`55-84`) | Managed-file copy transport is separate from artifact links. |
| `install/modules/pi.sh` | Package-manager/hoist (`106-136`), lifecycle (`238-295`), vendor-git (`331-387`) | Pi setup/provisioning, including shared-secret fallback used by OMP. Avoid speculative single-function files. |
| `install/modules/patches.sh` | Both engines and five adapters (`138-236`) | Upstream package compatibility has its own lifecycle; sourceable definitions support offline engine tests. |
| `install/modules/omp.sh` | Status applicator (`85-104`), native plugins/bun fallback (`297-329,389-420`) | One owner for native OMP integration and RETURN-trap cleanup. |
| `install/modules/tools.sh` | `check_tools` (`546-565`) using sibling `../tools` | Narrow check-only bridge to external tools, never an auto-installer. |

Move all eight baseline `tools/` files to `install/tools/` with `git mv`. Preserve modes and package installation logic. Adapter/master help and diagnostic advice change to recommend root. The master also adds validation and internal missing-status reporting. Existing `TOOLS_DIR` already uses its own BASH_SOURCE. No old-path shim is requested.

Dependencies: root → main → definition modules. Main invokes the master CLI as a child, never by sourcing it. Selected-tool preflight uses `--validate` before bootstrap. Explicit install actions run after normal work and Pi postlude, before the existing check bridge. Pi lifecycle uses artifact `link_one`. Patch wrappers share local engines. Keep `REPO_ROOT`, `PI_AGENT_DIR` and `PATCH_FAILED` context. Construct harness rows only after existing environment loading.

Capture explicit child failure without conditionally invoking the full lifecycle. Keep explicit stdout/stderr separate and still run the check. A deferred patch failure retains status 1. Otherwise return selected status or aggregate failure 1. Immediate repository failures abort before explicit installation.

**Path decision:** every module that resolves filesystem locations anchors them in its own `BASH_SOURCE`, never caller `$0` or assumed CWD. Main recovers the old root-entrypoint directory through its own `..` before applying existing git-root/PWD-fallback semantics. Shared `REPO_ROOT` remains resource context. Other path-owning modules derive their own anchors as needed; path-free definitions need no artificial locator boilerplate. Main loads helpers after bootstrap to preserve the environment/definition order. Definition modules neither load `.env` nor install anything on source. Preserve the legacy non-git fallback, not a new policy.

## Reference Migration Inventory

Move the guide to `install/TOOL_INSTALLATION.md`. Update links from root and tools README. Recommend root `./install.sh --tools` or `./install.sh --tool TOOL` with repository-root CWD explicit. Audit all tracked files and global skills, including agent-browser, Playwright, Chrome DevTools, gh-stack and visual-capture installation references. Internal direct flags remain supported, but must not be promoted as user install commands.

Retain unrelated `skills/tools/` catalog paths (`README.md:116-120`), companion links (`skills/visual/visual-capture/SKILL.md:13,28,54`, targeted search), `/2 tools/` regex (`harness/pi/tests/package-extensions.test.mjs:56`) and ordinary prose. Search tracked files again after moving; never replace substrings inside `install/tools/` or unrelated skill paths.

Implementation may briefly document internal layout in root `README.md` and `AGENTS.md`; no skill/agent rename/add/remove and no harness-managed artifact change occurs, so catalog rows and managed-file tables need no churn. Parent owns the plan README index.

## Validated Smell-to-Technique Summary

Execution path: **standard**, Fresh Air ranking performed locally because this leaf agent cannot fan out. Loaded `fresh-air/smells/index.json`, `technique-map/smell-to-technique.json`, `techniques/index.json`, plus detail files `moving-features-between-objects/extract-class.md` and `composing-methods/extract-method.md`. The graph has no entries for these smell IDs; the smell index provides explicit related-refactoring mappings, corroborated by technique metadata/details.

| Finding | Validated mapping | Primary action | Confidence / fallback |
| --- | --- | --- | --- |
| S1 | `divergent-change` → `extract-class` | Adapt Extract Class to cohesive Bash modules; no object framework. | High. Keep a tightly coupled function group in one owner if splitting adds dependency churn. |
| S2 | `long-method` → `extract-method` | Extract artifact-destination operation into `artifacts.sh`; retain dispatch/error context. | High. If wrapping orchestration changes shell semantics, retain that orchestration top-level in main's module. |
| D1 | `duplicate-code` → `extract-method` | Share literal tool-name validation for direct actions and preflight. | Required by the accepted CLI extension, not unrelated cleanup. |

**Processed: 3. Included: 3 after the accepted CLI extension. Unresolved smells: 0.** No unanswered planning questions. Highest-payoff boundary: definition-only package patches and their source-coupled test, then the remaining cohesive groups.

## Acceptance, Risks and Start Here

Acceptance requires a thin root, `install/main.sh`, six definition modules, eight tool files, and tests under the unified `install/` tree. Keep `main.sh` as the only runtime file directly under `install/`, with the guide exception. Preserve default statuses/manifests and inspect requested advice/help text differences. Verify strict root help/errors and explicit action ordering/status with recording adapters. Verify missing, present and skipped reports without a third probe. Both required tests must pass in safe fixtures. Compare streams, statuses, links, bytes, modes and rerun reports against baseline evidence. Use [implementation.md](implementation.md) for current results and coverage limits.

Execution risks: Bash dynamic scope/errexit and RETURN traps, initialization timing, own-path/worktree/non-root-CWD resolution, inherited key precedence, process-wide umask, deferred versus immediate failures and tests tied to root source text. Preserve quirks. Validation must not read real `.env`, modify live packages, reset real stores or install network dependencies.

**Start here:** `harness/pi/tests/package-patches.test.sh:9` and `install.sh:138-236`. Replace brittle root-text extraction with sourcing `install/modules/patches.sh`. Prove that imports have no runtime side effects. See [proposal.md](proposal.md) and [specs/01-install-modules.md](specs/01-install-modules.md) for the single-PR plan and implementation/test checklist. The parent owns reviewer acceptance and the plan README.
