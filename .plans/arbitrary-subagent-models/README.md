# Arbitrary subagent model dispatch

- Status: planning
- Summary: Let a Pi Lite capability profile accept validated per-spawn model and thinking overrides so routing no longer requires model-tier profile copies.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| System architecture | [2-system-architecture](./2-system-architecture.md) | done |
| Program design | [3-program-design](./3-program-design.md) | done |
| Vertical slices | [4-vertical-slices](./4-vertical-slices.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Runtime dispatch override | [01-runtime-dispatch-override](./specs/01-runtime-dispatch-override.md) |  | planned |
| 2 | Role-profile migration | [02-role-profile-migration](./specs/02-role-profile-migration.md) |  | planned |

## Decision log

- 2026-11-09 — Selected `.plans/` because it is the existing tracked plan base.
- 2026-11-09 — Sized as medium: the outcome is clear, but the Agent tool contract, package patches, runtime validation, profiles, policy, installer, and regression tests must agree.
- 2026-11-09 — Omitted model and thinking, including strict-mode `null`, retain the established profile/config/default behavior. Explicit values are resolved once at execution against the active registered, authenticated, scoped model set.
- 2026-11-09 — The Lite patch covers `src/registration.ts`, `src/agents/tool-execution.ts`, `src/agents/restart-last-agents.ts`, and `src/agents/agent-runner.ts`; its fixture and lifecycle tests cover all four files and the pinned package version.
- 2026-11-09 — Provider fallback must preserve child scope and authentication restrictions. The new scope patch is based on quota-patched `pi-fallback-models@0.1.1/src/extension.ts`; install quota first and scope second. Test pristine, quota-only, both-patched, quota-only upgrade, and repeat `ok` independently of live provider failures.
- 2026-11-09 — Completion provenance records provider-qualified requested, initial, and final model selections, with their thinking levels. Deterministic contract tests prove the fields; authenticated smoke is optional evidence.
- 2026-11-09 — The steady state uses five reserved capability profiles: `delegation-scout`, `delegation-researcher`, `delegation-planner`, `delegation-worker`, and `delegation-reviewer`. The routing policy, not filenames or frontmatter, selects model and thinking.
- 2026-11-05 — Slice 01 must patch `src/agents/agent-runner.ts` and include it in fixtures and guards so restrictive parent scope reaches child fallback lifecycle. Fallback is disabled when that scope cannot be recovered rather than widened.
