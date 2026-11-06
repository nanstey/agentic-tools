# Do not open a terminal by default for Orca worktree agent starts

- Status: blocked
- Summary: Document why the requested terminal-free worktree creation is blocked, the remaining Orca settings question, and the exact external and handoff changes required.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Discovery | [discovery](./discovery.md) | done |
| Proposal | [proposal](./proposal.md) | done |
| Validation | [validation](./validation.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Orca terminal-suppression dependency | [01-orca-terminal-suppression](./specs/01-orca-terminal-suppression.md) | — | blocked: Orca capability or verified setting |

## Decision log
2026-11-06 — Initialized the plan folder under the existing tracked `.plans/` convention. Assigned focused read-only discovery of Orca launch behavior and repository controls.
2026-11-06 — Discovery verified that `worktree create --help` creates the first terminal by default and exposes no terminal-suppression option. The registered repository settings expose no default-terminal control; whether an Orca global setting can suppress it remains unverified.
2026-11-06 — Review correction: any future suppression capability must be paired with a handoff redesign for session launch, retry handling, completion, and reporting. Removing only the additional Pi terminal does not deliver the requested behavior.
