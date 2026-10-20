# Unified-review build verification

## Scope

The user approved implementation through `build` and requested all slices in one PR.
The existing task branch contains the shared review contract, refactor routes, PR/workflow integration, and test artifacts.
No main-model routing, installed package, service, SDK, or runtime runner changes belong to this work.

## Encapsulation follow-up

The [2026-10-20 encapsulation verification](refactor-encapsulation.md) supersedes the
standalone-specialist preservation claim below. All eight methods/assets remain
internal to refactor; the original directories/entrypoints are removed. The current
suite has 36 passing static wording/structure tests, including shared DRY/SRP, finding-reuse, unique-rank, summary, padded-table/alias, and public-surface checks.
The user's `srp` trigger resolves to index ID `single-responsibility`. The earlier 24-test success preceded that manual edit.
Independent review found a stale parser failure after the edit. The corrected parser and current full rerun pass.
All four datasets live under refactor/references. Principles has 17 unique ranks in three groups, with numeric filename prefixes.
Clean Code guidance remains in an unranked summary, without an extra review pass or finding.
Authorized rank/order/path/group metadata changes and removal of the obsolete Clean Code ID replace earlier preservation claims for those fields.
Normalized comparisons preserve all 17 retained card bodies and stable metadata, except the removed Clean Code related-ID reference.
Other dataset assets retain their original bytes. No new live Jev checks or runtime installs ran.

## Approved public surface and current validation

The user selected simplify/extract/principles/smells with default fixes and optional `--report`, then clarified: “refactor without any options should be an exhaustive review and automatic fixes”. This supersedes the earlier menu/router and report/lite-first permission rules, not external callers' restrictions.
Bare review covers maintained source/tests/config, all 17 ordered principles, applicable smell families, single-owner DRY/SRP with extraction placement, simplification and structural/deep maintainability. Selected goals narrow primary coverage. Both modes retain identical chosen coverage; incomplete work stays visible. Technique planning is internal, not a public plan command. At most one goal precedes scope; invalid scope, misordered or repeated goals, unknown flags, old selectors, and unrecognized non-flags stop without falling through to auto-fix.
All methods inherit explicit execution context. A slash invocation or explicit request to review and fix authorizes supported behavior-preserving fixes without another selected-cut approval; loading, quoting, discussion, review-only requests, and read-only callers gain no edits. Risk-review and idea-to-pr receive minimal report-mode handoff corrections only.

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: **36 pass**, ten original, fifteen encapsulation, eleven public-surface wording/structure tests. They do not execute flag rejection or runtime enforcement; no executable argument parser or runtime refactor engine was added.
- `bash -n install.sh && bash install/tests/install.test.sh`: **pass**, nine offline temporary-fixture groups.
- `bash harness/pi/tests/package-patches.test.sh`: **pass**, four temporary-fixture scenarios.
- Protected corpus: all **112 paths and SHA-256 values** match the supplied pre-surface manifest. The permanent aggregate path/hash digest is `cb24497f71e95f0bdd3c27658f04f48020572ed6212ec370135e42ac9cca01a9`.
- User's padded principles mapping table and srp alias are preserved; tests assert exact table bytes as well as tolerant alias resolution.
- HEAD remains `615378008972c923d772e138f466285f2f6db84b`; index remains empty. No branch/worktree, stage, commit, push, remote mutation, or real installation occurred. The refactor skill was not executed against this repository.

These are static wording/structure contracts and offline tests, not runtime behavioral proof. See [current surface evidence](refactor-encapsulation.md#approved-public-surface-redesign-and-validation-2026-10-20) for the permission decisions and coverage limits.

## Earlier executed checks

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: ten tests pass.
  These tests inspect fixture structure, question shapes, and source instructions. They do not execute an agent or lifecycle engine.
- The fixture file contains 26 labeled replay scenarios. Their runtime replay status remains `not_run`.
- [Live Jev smoke record](jev-smoke.json): five synthetic cases returned valid response shapes.
  Four expected Choice labels matched. The coordinator discarded the inadequate-baseline case's forced `existing` answer.
  The bounded-artifact case retains incomplete source coverage despite supported containment. No probability cutoff applies.
- Inline Python checks pass for frontmatter/names, exact catalog descriptions, HTML source digest/anchors, whitespace, and local links.
  The initial check covers 24 Markdown files and 134 local/anchor links.
  The unchanged root README anchor `#pi-agent-profiles` is already broken at the baseline and remains outside this change.
- All eight preserved specialist directories match the task baseline: deep-review, extract, sniff, dry, srp, principles, fresh-air, and ponytail.
- After merging current `main`, `bash -n install.sh`, `bash harness/pi/tests/package-patches.test.sh`, and `bash install/tests/install.test.sh` pass.
  The installer suite uses offline stubs and temporary directories. No global installation ran.
- Post-synchronization checks pass at `0f931e2`, including all ten static tests, catalog consistency, exact PR scope, and credential/machine-path scans.
- `git diff --check` passes.
- Deslop checks pass for new review/refactor/gate prose. Two plan-document candidates use `harness` as the technical platform noun and remain intentional.

## Independent review status and limits

The original build's Anthropic preflight failed with an extra-usage quota error. That limitation is historical. The later independent source review and correction recheck closed R1–R5 and M1/L1–L5/N1–N2 with zero blocking findings for the local refactor scope.
The coordinator verified the producer and reviewer families from successful session messages. Producers used OpenAI models. The reviewer used only `anthropic/claude-sonnet-5-5`, with 41 successful messages at final verification.
The reviewer independently reran all 36 static tests, diff checks, and protected path/hash/table checks. The coordinator also reran the 36 tests. These checks do not prove runtime behavior or tool isolation. The 26 replay fixtures remain unexecuted.
The PR remains draft. These local changes remain uncommitted and unpublished. No whole-PR source-quality/security readiness is claimed.

## GitHub policy observation

At base `8ee93a7200728b080ab0afbd42bfb5ac9d837b8e`, GitHub reports no branch protection, disabled repository rulesets, no active branch rules, and no Actions workflows.
This is policy evidence about expected checks, not a pass inferred from an empty observed check list.
Refresh policy and PR snapshot evidence before any later readiness decision.

## Limits and next steps

The live cases test typed judgments on synthetic supplied facts. They do not calibrate model accuracy or establish complete impact discovery.
Prompt/static checks do not prove tool restrictions, full agent execution, or complete GitHub lifecycle behavior.
The [pilot protocol](../pilot.md) defines later labeled replay and measurements for defects, clean changes, noise, rounds, and human effort.
No operational or longitudinal measurements are claimed.

## Publication result

[Draft PR #114](https://github.com/nanstey/agentic-tools/pull/114) contains all slices on the existing branch. Its structured body states the validation limits.
A snapshot-only monitor observation finds no reviews, threads, comments, or observed jobs. The PR is not review-ready.
No source review/fix loop completed, and no independent quality/security packet establishes readiness. Keep the PR draft until the missing review evidence exists.
