# Installer baseline

Baseline gates pass at `37200468608b0b4bea916567d4985ee5253cd0bb` on branch `install-modules`, before implementation changes. Both existing tests pass. All five package patches report `patched` on the first installer run and `ok` on the second. The two post-install filesystem manifests match. An independent repeat capture matches the baseline exactly after temporary-path normalization.

Only this report is written in the repository. Raw evidence, dependency copies, fixtures, and the reusable verifier remain outside git. Their locations are provided in the task return, not recorded here. No specification scenarios are marked complete.

## Isolation

- Each command receives a clean environment, temporary `HOME`, `PI_CODING_AGENT_DIR`, `TMPDIR`, XDG directories, and package/Jiti cache locations. No inherited credentials or subagent activity paths reach the tests.
- `PATH` contains an explicit utility allowlist and local fixtures. Real harnesses, browsers, external tools, package managers, HTTP clients, and privilege commands are excluded. Unexpected package/network commands fail and leave an evidence log.
- The git fixture delegates only read-only repository `rev-parse` calls to real git. Vendor clone/checkout operations create local placeholder files instead of contacting a remote.
- The OMP fixture records plugin and schema-setting operations beneath the temporary HOME. Its `install` operation simulates registration; it never installs packages. A callable bun fixture fails if executed.
- The extension smoke test uses physical copies of the SDK and complete package dependency trees. Copies have no symlinks escaping their tree. A Node preload blocks socket connections, DNS lookup, and fetch. No blocked command or network attempt occurs.
- A fixed dummy Typesafe key tests secret/environment-file creation without reading real secrets. The verifier refuses a checkout containing `.env`, so the installer's shell-source behavior cannot execute machine-local assignments.
- Tracked repository file hashes match before and after execution. No installed package is patched, no real HOME is targeted, and no branches, commits, or PRs are created.

## Fixtures

The package applicator test supplies only a synthetic two-line package. For full installer coverage, temporary copies of installed targets are restored to pristine form by reversing the repository patches, including both Jev patches, and removing the fallback quota addition. Reversal succeeds for every patch. The installed originals remain untouched.

| Dependency | Version |
| --- | --- |
| Pi SDK | 1.3.0 |
| `@heyhuynhgiabuu/pi-diff` | 0.9.3 |
| `@maplezzk/pi-interactive-subagents` | 3.16.4 |
| `pi-jev` | 0.7.0 |
| `pi-fallback-models` | 0.1.1 |

The main HOME fixture contains all four harness directories, two OMP profiles with existing skills/agents destinations, an outdated Pi settings file, one real-path skill conflict, one incorrectly pointed agent symlink, and one dangling retired-skill symlink. It contains pristine patch targets and an existing `node-linker=hoisted` setting so hoist initialization does not delete the patch fixtures.

A separate HOME fixture starts with a non-hoisted `.npmrc`, a disposable package-store marker, and a lockfile. This exercises the destructive hoist reset and missing-package skips without weakening the pristine-patch check. It also exercises absent Claude/Codex detection and unmatched OMP profile globs.

Toolchain: GNU Bash 5.2.21, Node 22.19.0, Python 3.12.3, git 2.52.0, GNU patch 2.7.6 on Linux. These results do not establish BSD/macOS behavior.

## Commands and results

`REPO` is the checkout; `RUN` is a fresh external output directory. `TOOLS` is `tools` for this baseline. Commands run from `REPO` under the isolated environment described above. The verifier records exact argv, cwd, and environment in `commands.json`.

| Evidence label | Command | Exit | Result |
| --- | --- | --- | --- |
| `preflight-package-extensions` | `node "$REPO/harness/pi/tests/package-extensions.test.mjs" "$RUN/sdk/node_modules/@earendil-works/pi-coding-agent" "$RUN/preflight-home/.pi/agent"` | 0 | pi-diff loads the host SDK and registers write/edit/apply_patch; both widget views hide denied tools while caller_ping remains denied. |
| `preflight-package-patches` | `bash "$REPO/harness/pi/tests/package-patches.test.sh"` | 0 | Apply then ok; missing package skips; upstream mismatch and failed later hunk leave the file untouched. |
| `install-first` | `bash "$REPO/install.sh"` | 0 | 47 skills and 5 agents per supported destination; overwrite/repoint/dangling cleanup; config copy/update; all five patches apply. |
| `install-second` | `bash "$REPO/install.sh"` | 0 | Links, configs, vendor, patches, and status-line settings report ok; plugin version reports up to date. Filesystem unchanged from first run. |
| `tools-help` | `bash "$REPO/$TOOLS/install.sh" --help` | 0 | Usage, options, environment, and examples captured. |
| `tools-check` | `bash "$REPO/$TOOLS/install.sh" --check` | 0 | All dependencies absent; `Summary: 0/6 tools installed`. |
| `tool-gh-missing` | `bash "$REPO/$TOOLS/gh.sh" check` | 1 | Expected individual missing-dependency failure. |
| `hoist-first` | `bash "$REPO/install.sh"` | 0 | Appends hoist setting, removes disposable store and lockfile, skips absent patch targets. |
| `hoist-second` | `bash "$REPO/install.sh"` | 0 | Hoist reports ok; filesystem unchanged from first hoist run. |

All nine commands have empty stderr. Both full verifier executions pass; their exact comparison produces an empty diff.

### Behavior to preserve

- Aggregate `tools/install.sh --check` returns **0 even with missing dependencies**. Individual `tools/gh.sh check` returns **1** when gh is absent. The root installer therefore prints the missing-tool status but does not print its conditional installation advice in this fixture.
- Patch labels `patch-diff-sdk`, `patch-fallback`, `patch-subagent-widget`, `patch-jev-client`, and `patch-jev-prompt-guard` each report `patched`, then `ok`. All final target hashes match the copied, installed patched targets.
- OMP status-line setup applies ten settings to the default agent and each profile, then reports ok. The synthetic plugin registration reports one installed, then one up to date.
- The referenced `harness/omp/plugins/pi-intercom.txt` is absent at the base commit. Its skip message is expected baseline output, not a fixture failure.
- The self-improve record contains the common git checkout root rather than the current worktree root. That root is read, never modified.
- Main post-install manifests contain 406 entries, including 309 symlinks. Both hoist manifests contain 164 entries. Mode bits and file contents, not only existence, are compared.

## Evidence and replay

The external evidence store contains:

- `fixtures/pristine-packages`: minimal pristine third-party patch targets and package metadata.
- `fixtures/agent-node_modules` and `fixtures/sdk-node_modules`: copied dependency trees for the extension preflight.
- `fixtures/versions.json`, `fixtures/installed-target-hashes.json`, and `fixture-preparation.log`: fixture provenance and expected patched hashes.
- Per command: raw `.stdout`, `.stderr`, and `.status`, plus separate normalized stdout/stderr.
- Before/after HOME manifests: relative paths, entry types, modes, symlink targets, file byte counts, and SHA-256 hashes. Raw and normalized manifests are separate.
- `fixture-commands.jsonl`: synthetic git/OMP operations; `commands.json`: executed commands and clean environments; source hash snapshots; `summary.json`: gate results.
- A separate repeat capture and its empty `comparison.diff`.

Use the external verifier with its sibling fixtures intact:

```bash
python3 "$VERIFY" "$REPO" --output "$AFTER" --compare "$BASELINE"
```

`AFTER` must be absent or empty and outside the repository. The verifier finds `src/tools/install.sh` first, then `tools/install.sh`; it does not require a compatibility copy at the old path. It runs preflights, creates fresh HOME fixtures, installs twice, checks tools, and verifies source integrity. Exit 0 means gates and exact comparison pass. Exit 2 means behavioral assertions pass but captured output/manifests differ; inspect `comparison.diff`. An assertion/test failure is a gate failure.

Normalization replaces only the variable external run/evidence roots and the random vendor `.clone.*` basename. It does not remove messages, reorder output, change counters, normalize checkout/common-root paths, or equate `tools` with `src/tools`. Raw evidence is unchanged. Normalized manifests hash normalized file bytes; timestamps, ownership, and inode numbers are excluded. Repeating in another checkout can therefore show real absolute-path differences.

## Limits for the implementation comparison

- The tools move changes `$0` in help output. Expect that precise `tools/install.sh` to `src/tools/install.sh` delta; the comparator preserves it for review rather than hiding it.
- `package-patches.test.sh` extracts `apply_package_patch()` from the root installer. Module extraction must update this test's definition-loading path without running installer side effects.
- Vendor and OMP operations are command-contract fixtures, not tests of remote availability, real cloning, package-manager behavior, or the real OMP schema implementation.
- No real installation flags are executed. Installed-tool checks, interactive prompts, missing patch utilities, vendor fetch/update failures, and end-to-end patch-failure aggregation are outside this capture. Upstream mismatch and atomic multi-hunk failure are covered by the existing applicator test.
- Keep the external evidence until after the refactor comparison; it is temporary and is not recoverable from git.
