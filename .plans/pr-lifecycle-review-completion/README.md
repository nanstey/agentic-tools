# PR lifecycle review completion

- Status: implemented; static documentation traces validated
- Summary: Bare `/pr` completes only after final-head review and monitor finish, or reports a documented blocked state. A `mode: once` external-head race permits one reconciliation, then blocks on continued head churn. Each `/pr review` invocation has its own three-round review/fix limit. Validation evidence is static read-through of the documentation, not executed behavior, plus the passed installer regression below.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Proposal | [proposal.md](proposal.md) | implemented |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Per-invocation review limit, blocked form, lifecycle completion gate (single lock-step slice across `pr`, `review-code`, `idea-to-pr`, `build`, `risk-review` docs) | [01-per-invocation-review-completion.md](specs/01-per-invocation-review-completion.md) | — | implemented; static documentation traces validated |

## Validation evidence
- 2026-10-22 — `bash install/tests/install.test.sh` passed. This installer regression confirms installer behavior only; lifecycle documentation claims remain static read-through traces.

## Decision log
- 2026-10-22 — Created for the autopilot update. `.plans/` is the existing tracked plans directory.
- 2026-10-22 — Proposal written. Review/fix round limit is per invocation (`/pr review fix`, and each remediating action invocation), not session or cross-action.
- 2026-10-22 — Implemented the lock-step documentation slice and validated it through static read-through traces, not executed behavior. Bare lifecycle starts missing review coverage in-run, reports the exact coordinator-dispatch blocker when unavailable, and cannot return before the completion gate. Each remediating action owns its invocation limit; packet/findings/evidence still carry for freshness, deduplication, and no-progress safeguards.
- 2026-10-22 — Corrected the `mode: once` external-head race: one reconciliation reuses monitor-created fresh coverage or starts the ownership-appropriate review, then re-monitors once. Continued head movement blocks as external head churn or no progress rather than looping.
