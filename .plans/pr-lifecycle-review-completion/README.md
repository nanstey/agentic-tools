# PR lifecycle review completion

- Status: implemented and validated
- Summary: Bare `/pr` completes only after final-head review and monitor finish, or reports a documented blocked state. Each `/pr review` invocation has its own three-round review/fix limit.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Proposal | [proposal.md](proposal.md) | implemented |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Per-invocation review limit, blocked form, lifecycle completion gate (single lock-step slice across `pr`, `review-code`, `idea-to-pr`, `build`, `risk-review` docs) | [01-per-invocation-review-completion.md](specs/01-per-invocation-review-completion.md) | — | implemented and validated |

## Decision log
- 2026-10-22 — Created for the autopilot update. `.plans/` is the existing tracked plans directory.
- 2026-10-22 — Proposal written. Review/fix round limit is per invocation (`/pr review fix`, and each remediating action invocation), not session or cross-action.
- 2026-10-22 — Implemented and validated the lock-step documentation slice. Bare lifecycle starts missing review coverage in-run, reports the exact coordinator-dispatch blocker when unavailable, and cannot return before the completion gate. Each remediating action owns its invocation limit; packet/findings/evidence still carry for freshness, deduplication, and no-progress safeguards.
