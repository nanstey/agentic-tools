# Make subagent model and thinking choices more conservative

- Status: committed locally, independent review and publication blocked
- Summary: Conservative Pi subagent routing, lower defaults, composable Jev thinking protection, and benefit-based OMP delegation.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Proposal | [proposal](./proposal.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Conservative routing policy | [proposal](./proposal.md) |  | committed, independent review blocked |

## Decision log
2026-10-20 — Selected one coordinated slice because the routing table, profile defaults, fallback, self-improvement policy, installer patch, tests, and documentation must agree.

2026-10-20 — The Jev self-improvement patch must target router construction, not the existing patch's default-flag hunk. This keeps each patch reversible and installer runs idempotent.

2026-10-20 — Implemented the approved slice. Pi uses evidence-bounded tiers and thinking, lower profile and self-improvement defaults, and Terra then Sonnet fallback. Reviewer rows and retries preserve family independence. OMP delegates only for material benefit.

2026-10-20 — Committed the slice locally as `b12658e`. Anthropic review is blocked by a provider usage error, so no PR was published. The OpenAI fallback review found no implementation blockers but is not independent verification.

2026-10-20 — Regression fixtures use pristine pi-jev 0.7.0 sources with their MIT license. Sandboxed installation passes twice for all eight patch subsets. The tests exercise the real thinking router with stubbed model capabilities and the real OMP status-line applicator with a stubbed config CLI. Main-agent model policy, existing Jev patches, and OMP profile-local model roles remain unchanged.

2026-10-20 — The metadata-only session aggregation reproduces all 19 proposal rows from 41 launches and 39 usable sessions. Two child logs are unavailable. Excluding two aborted messages leaves the counts unchanged. Initial stricter assertions exposed these sample limits, not an implementation failure.

## Validation

- PASS: `git diff --check`.
- PASS: `jq empty harness/pi/extensions/pi-fallback.json harness/pi/self-improve.json`.
- PASS: `bash -n install.sh` and `bash -n harness/pi/tests/package-patches.test.sh`.
- PASS: `node --check harness/pi/bin/pi-improve`.
- PASS: `bash harness/pi/tests/package-patches.test.sh` (17 checks, including 16 sandbox installer runs and five thinking scenarios).
- PASS: `bash harness/pi/tests/pi-improve.test.sh` (33 passed, 0 failed).
- PASS: Python policy assertions and manual scenario review cover low confidence, evidence bounds, high blast radius, exception reasons, reviewer families, and retries.
- PASS: Python/`jq` metadata-only aggregation reproduces the proposal sample and validates the available-log schema.
- LIMIT: No live model-quality or cost benchmark. Fixture execution uses Node's experimental `stripTypeScriptTypes` API and reports its warning.
