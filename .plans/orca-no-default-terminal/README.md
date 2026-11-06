# Reuse Orca's initial terminal for Pi handoff

- Status: partially delivered
- Summary: The handoff skill now reuses the implicit initial terminal that Orca creates with a fresh worktree, so it does not create a second terminal for Pi. Terminal-free worktree creation remains unavailable because Orca still creates that initial terminal by default.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Discovery | [discovery](./discovery.md) | done |
| Proposal | [proposal](./proposal.md) | revised for delivered optimization |
| Validation | [validation](./validation.md) | updated after implementation |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Repository handoff terminal reuse | [01-orca-terminal-suppression](./specs/01-orca-terminal-suppression.md) | — | delivered: reuses one safe implicit terminal and sends Pi input without creating another terminal |
| 2 | Terminal-free worktree creation | [01-orca-terminal-suppression](./specs/01-orca-terminal-suppression.md) | — | blocked: requires an Orca setting or CLI/API capability to suppress the implicit initial terminal |

## Decision log
2026-11-06 — Initialized the plan folder under the existing tracked `.plans/` convention. Assigned focused read-only discovery of Orca launch behavior and repository controls.
2026-11-06 — Discovery verified that `worktree create --help` creates the first terminal by default and exposes no terminal-suppression option. The registered repository settings expose no default-terminal control; whether an Orca global setting can suppress it remains unverified.
2026-11-06 — Review correction: any future suppression capability must be paired with a handoff redesign for session launch, retry handling, completion, and reporting. Removing only the additional Pi terminal does not deliver the requested behavior.
2026-11-06 — User approved the interim repository optimization: keep Orca's implicit first terminal and start Pi by safely reusing it with `terminal send`. The handoff must fail rather than choose an ambiguous terminal, and must use `--retry-request` replay rather than a fresh send after an ambiguous transport failure.
