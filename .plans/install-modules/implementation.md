# Root tools CLI, guide move and missing-tool advice

The latest revision is implemented and locally validated. Root uses `--tools` and `--tool TOOL` without obsolete aliases.
Missing tools print one shell-safe root command while default root still succeeds.
The guide lives at `install/TOOL_INSTALLATION.md`. Anthropic review remains quota-blocked. Reviewer acceptance is not claimed.

## Current decisions and layout

The latest user request supersedes the earlier long flag spellings and the main-only directory rule for one document.
`install/main.sh` is the only runtime file directly under `install/`. `install/TOOL_INSTALLATION.md` is the explicit documentation exception.
Definitions, tool implementations and tests keep their subdirectories. Root `install.sh` remains five lines and calls main outside conditional context.

| Path | Current role |
| --- | --- |
| `install/main.sh` | Strict root parser/help, validation child, bootstrap, normal work, explicit action and final failure policy. |
| `install/modules/artifacts.sh` | Collectors, links, destination handling, counters and cleanup. |
| `install/modules/config.sh` | Managed-file copies and executable handling. |
| `install/modules/pi.sh` | Hoist/vendor provisioning, secrets/environment, CLI links and checkout recording. |
| `install/modules/patches.sh` | Both definition-only patch engines and all five adapters. |
| `install/modules/omp.sh` | Status settings, plugins and temporary bun/RETURN cleanup. |
| `install/modules/tools.sh` | Shared status report and quoted root installation advice. |
| `install/tools/` | Authoritative master registry/validation and six internal adapters. |
| `install/tests/install.test.sh` | Safe offline regression, including guide and public-help assertions. |
| `install/TOOL_INSTALLATION.md` | Public root-install guide, moved with `git mv`. |

Main still parses before REPO_ROOT, `.env`, helper imports or installation. Selected preflight invokes the master child with `--validate`.
Root has no duplicate registry. Help and rejected arguments have no bootstrap/check/write effects.
Explicit actions preserve normal-work/postlude/install/report ordering, environment, separate streams and failure precedence.
Selected status 9 propagates after reporting. Aggregate failure returns 1. Deferred patch failure retains status 1. Immediate OMP failure still aborts before tools.

## Reliable missing status

The master adds internal `--check-status`. It calls the same `check_all` function with a strict flag.
A single guard returns 1 when the existing non-skipped missing counter is positive.
Direct `--check` keeps status 0 for missing tools. Present/all-skipped strict reports return 0.
No registry, counter calculation, output parser, sentinel protocol or third probe was added.

The bridge uses the internal mode in its conditional pipeline. For missing tools, it prints one root `bash <path>/install.sh --tools` command.
Bash `printf %q` quotes the path. The guide pointer uses its moved location.
There are no hardcoded specific-tool examples in missing-tool advice. Advice does not change default root success or explicit failure status.

## Public-reference audit

All tracked Markdown outside historical plans was scanned for managed CLI bypass commands. No recommendations remain for direct adapters/master install commands or manual managed-CLI npm/brew/extension installation.
Current root help, master examples, adapter help, README and tools README promote root installation with repository-root CWD explicit.
Direct master/adapter flags remain internal compatibility interfaces. Actual package-manager implementation commands are unchanged.

Five global skill/reference files now use the same root contract:

- `skills/tools/agent-browser/SKILL.md`
- `skills/tools/playwright-cli/SKILL.md`
- `skills/tools/chrome-devtools-cli/references/installation.md`
- `skills/dev/pr/references/stack-cli.md`
- `skills/visual/visual-capture/SKILL.md`

These changes are coupled to the same public CLI and belong with it in one PR.
Unrelated ffmpeg/runtime/browser prerequisites, companion-skill links and `gh skill install`/`npx skills add` agent-skill instructions remain.
Catalog rows, frontmatter names/descriptions, package versions, patches and extension-test assertions remain unchanged.
Current guide links resolve. The parent-owned plan README was not edited.

The guide and tools README were rewritten to remove bypass instructions and duplicate installation paths.
`git mv` records nine staged moves, including the guide and eight tool files. Executable/document modes remain unchanged.
The combined default-similarity diff shows both rewritten documents as delete/add rather than detected renames. This is recorded, not hidden.
There are 26 logical runtime/docs files. Default diff accounting shows 28 path entries, 1380 insertions and 1347 deletions, excluding planning artifacts.
Main is 168 lines, definitions total 490, the master is 235, and regression is 400 lines.

## Fresh validation

| Check | Result |
| --- | --- |
| `bash install/tests/install.test.sh`, twice | PASS, nine groups each. Both return 0 with identical stdout and empty stderr. |
| `bash -n` on root, main, six modules, regression, seven tools and patch test | PASS, 17 scripts. |
| `bash harness/pi/tests/package-patches.test.sh` | PASS directly and through the verifier. Every assertion remains. |
| Required extension test through safe SDK/package verifier fixtures | PASS, exit 0, empty stderr. Network guard remains active. |
| Exact baseline verifier | Behavioral checks PASS. Comparison exits 2 for the six requested text records below. |
| Package adapter/control-flow audit | PASS after excluding help/comments and explicitly listed advice strings. Package commands are unchanged. |
| Master core audit | Normalization, skips, runner and all-install loop unchanged. Check report differs only by the strict-counter return guard. |
| Guide structure, links, public references and protected content | PASS. |
| Source hashes during regression | PASS, including new/untracked installer files. |
| Working and cached `git diff --check` | PASS. |
| ShellCheck | Not installed. Not run. |

The regression covers current and obsolete flag rejection before effects, root-directed help for every adapter, literal validation, aliases, skip/environment forwarding and exact action order.
It retains permissions, global umask, traps, hoist/vendor, patch and OMP failure assertions.
New report assertions cover direct/strict output equality, unchanged probe count, missing/default success, all-present/all-skipped silence and one quoted command outside CWD with spaces.
A safe shell argument reconstruction checks the printed command without executing installation.

All explicit install actions use recording adapters. No actual external installer runs for an install action.
New CLI assertions are not claimed to pass the original root. The supplied original capture remains the comparison reference, with all latest reporting differences retained.

## Exact baseline differences

**27 of 33 compared records are byte-identical.** All statuses, stderr records, command ordering and manifests match.
No normalization was added or loosened. Every line of `comparison.diff` was inspected and matched to an explicit requested change.

| Changed record | Exact category of change |
| --- | --- |
| `install-first.stdout.normalized` | gh-stack missing-prerequisite text replaces the external install URL. Three lines add root advice and the moved guide pointer. |
| `install-second.stdout.normalized` | The same prerequisite replacement and three advice lines. |
| `hoist-first.stdout.normalized` | The same prerequisite replacement and three advice lines. |
| `hoist-second.stdout.normalized` | The same prerequisite replacement and three advice lines. |
| `tools-check.stdout.normalized` | Only the gh-stack prerequisite replacement. Direct status remains 0. |
| `tools-help.stdout.normalized` | Relocated internal usage/check/help paths, internal CLI labels, new validation/status options, updated check/install descriptions and root-only installation examples using `--tools`/`--tool`. |

Each root advice block contains the missing-tools header, one root command and the moved guide path.
The prerequisite message now says `Missing prerequisite: GitHub CLI (gh).` instead of recommending an external installation URL.
Master help no longer recommends internal installation commands. Its actual internal flags remain implemented.

All nine verifier command statuses match baseline. Eight return 0 and the individual missing-gh check returns 1. All have empty stderr.
All five patches report `patched`, then `ok`, and target hashes match fixture expectations.
Main manifests retain 406 entries with 309 symlinks. Hoist manifests retain 164 entries with 106 symlinks.
Each rerun matches its first-run filesystem. No blocked network/install attempt occurs.

## Evidence and limits

Evidence remains outside git:

- Baseline: `install-modules-baseline.iAJn49/capture`.
- Unchanged safe verifier copy: `install-modules-baseline.iAJn49/verify-unified-layout.py`.
- Fresh capture and exact diff: `install-root-cli-after.jGg2tG`.
- Regression, syntax, source hashes, per-adapter diffs, reference audits and move summaries: `install-root-cli-validation.lzcSFT`.

```bash
python3 "$VERIFY_COPY" "$PWD" --output "$AFTER" --compare "$BASELINE"
```

The verifier copy still changes only directory detection and its diagnostic. Fixture lookup, isolation, assertions and normalization remain unchanged.
The original verifier and baseline capture were not edited.

All 17 Test Scenarios remain reviewer-owned and unaccepted. Fixtures do not establish every environment/profile/failure combination or live installation behavior.
Linux-only verification does not establish macOS/BSD behavior. Actual package managers, browsers, privileges, prompts and networks are not exercised for installation.
No new branch/worktree is created. Existing linked-worktree metadata and a synthetic common-dir contract remain covered.
Real HOME, machine `.env`, credentials, installed packages and stores remain untouched.
No commit, push or PR was made. Anthropic review remains unavailable. The parent must complete acceptance before publication.
