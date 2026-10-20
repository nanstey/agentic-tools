# Unified Risk-Based Review

- Status: planning
- Summary: Plan one portable review process that scales with change risk and rollback cost.
- Mode: gated. The user must approve the completed plan before implementation starts.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Self-contained plan and audit appendices | [Proposal](./proposal.md) | done, awaiting user approval |

## Stage status
| Stage | Status | Result |
| --- | --- | --- |
| Triage and scope | done | Research and planning only, existing branch/worktree |
| Repository audit | done | 26 skills, five profiles, harness and installer contracts |
| Historical usage audit | done | 48 names, channel-specific counts and limits |
| Anthropic research | done | Requested sources and documented adaptations |
| Planning | done | Product outcome, architecture, program design, six slices |
| Deterministic validation | done | Parser fixtures, count consistency, links, privacy and diff checks |
| Cross-family plan review | blocked | Anthropic quota unavailable. No independent approval claimed. |
| User approval | waiting | Approve or change the defaults in the proposal |
| Specs, implementation and publication | skipped | Outside this planning gate |

## Evidence
- [Repository audit](./evidence/skill-audit.md) and [inventory](./evidence/skill-inventory.json).
- [Historical usage method and limits](./evidence/usage-audit.md) and [aggregate counts](./evidence/usage-counts.json).
- [Anthropic source research](./evidence/anthropic-review.md).
- [Executed checks and review limitations](./evidence/verification.md).
- The proposal contains the complete audit matrix, counts, design, decisions, and validation plan.

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Manual opt-in risk-review | — | — | planned, not authorized |
| 2 | Proven existing-harness dispatch or explicit block | — | — | planned, not authorized |
| 3 | One automatic review checkpoint across callers | — | — | planned, not authorized |
| 4 | Retire deep-review | — | — | planned, not authorized |
| 5 | Refactor owns placement planning | — | — | planned, not authorized |
| 6 | Retire extract | — | — | planned, not authorized |

## Decision log
- 2026-10-20 — Started research and planning only. Keep the existing task branch and worktree.
- 2026-10-20 — Selected `.plans/` because the repository already tracks plan folders there.
- 2026-10-20 — Assigned three independent read-only tasks: repository audit, historical usage audit, and Anthropic review research. Each task writes outside the checkout.
- 2026-10-20 — The requested deliverable is one self-contained plan with an audit appendix. Product intent, architecture, program design, and vertical slices will form ordered sections in `proposal.md`.
- 2026-10-20 — Implementation, skill changes, agent changes, harness changes, and PR publication remain outside this approval gate.
- 2026-10-20 — Completed all three research assignments. Preserved sanitized evidence in this folder and integrated the results into the proposal.
- 2026-10-20 — Counted confirmed nested-tool calls after checking trace semantics. The parent reran 17 parser fixtures and four bound fixtures successfully.
- 2026-10-20 — Selected `risk-review` because `review` conflicts with reserved commands. Proposed merging `deep-review` into its structural lens and `extract` into `refactor`.
- 2026-10-20 — Rejected a new review runner. Existing harness dispatch must prove family and tool enforcement before automatic integration.
- 2026-10-20 — Checked successful-message model provenance. Research and proposal production used OpenAI after Anthropic quota failure. Cross-family plan review remains unavailable.
- 2026-10-20 — Prepared a local planning-artifact commit on the existing task branch. No remote publication or implementation is part of this deliverable.
- 2026-10-20 — Completed the plan and stopped at the user approval gate. No specs or implementation files exist for these slices.
