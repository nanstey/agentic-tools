# Review provenance and publication policy

- Status: building
- Summary: Diagnose unavailable review agents, then make third-party reviews multi-family and keep internal coordination out of published PR comments.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Proposal | [proposal](./proposal.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Review policy and publication | [01-review-policy-and-publication](./specs/01-review-policy-and-publication.md) |  | building |

## Decision log

- 2026-11-05 — Selected `.plans/` because it is the tracked plan base.
- 2026-11-05 — The fixed-tier profiles and installer are present in the repository, but the active runtime profile directory is empty and rejects fixed types. Treat this as stale local installation, not an installer defect; rerun `install.sh` and restart Pi after shipping.
- 2026-11-05 — Ship one lock-step PR because review-code, PR publication, profile, harness, catalog, and test rules must agree.
- 2026-11-05 — Static acceptance and installer validation passed. Fixed-tier review agents remain unavailable in this session, so independent Agent QA is unavailable until the profiles are installed and Pi restarts.
