---
name: flow-design
description: Designs a platform-neutral delegation plan with roles, gates, and return contracts. Use when a task needs coordinated execution designed before work begins.
user-invocable: true
disable-model-invocation: false
---

# Flow Design

## Core Contract

Turn one task into a concrete execution plan expressed as responsibilities, dependencies, write isolation, validation gates, and return contracts. Let the active environment map that plan to its own agents, tools, models, and coordination mechanism.

Design-only: never execute the plan, edit source, or dispatch work. The caller (a user, `idea-to-pr`, or `build`) executes it. A validation-environment preflight is allowed because it verifies a proposed gate rather than executing the task.

If delegation is unavailable or unnecessary, design an inline sequence instead. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task: outcome, boundaries, and acceptance criteria.
2. Validation tooling available (test command, linter, typecheck, E2E runner, how to boot the app).
3. Approval points or delivery constraints.
4. Whether the task writes to the repo, and whether independent writers are plausible.

If acceptance criteria are absent and cannot be derived from the task, stop and ask.

## Design Rules

### Least coordination first

Use the simplest shape that preserves correctness:

- Complete small cohesive work inline.
- Give one focused responsibility to one delegated task.
- Run independent read-only scopes concurrently when useful.
- Separate implementation from acceptance review for consequential changes.
- Sequence dependent phases and approval points.
- Isolate concurrent writers; otherwise serialize them.
- Give multi-source research one synthesis owner.

### Responsibilities and gates

- Give each role one clear responsibility and expected result.
- Keep one owner for shared state, cross-task decisions, and final integration.
- Let the environment select agents, tools, models, and delegation depth.
- Attach a deterministic validation command to every phase that produces code.
- For runnable behaviour, include a runtime verification step that exercises the acceptance scenarios. Unit tests alone are insufficient.
- State acceptance criteria and required evidence in each return contract.
- With a spec checklist, implementation owns `## Implementation` items and QA/review owns `## Test Scenarios`.
- Keep concurrent writers out of a shared checkout.

Track timing, cost, token use, or other resource data when the environment provides it. Add explicit limits only when the user requests them or the environment requires them.

## Workflow

1. Restate the task, acceptance criteria, and whether it writes to the repo.
2. Choose the least-coordination execution shape.
3. Assign responsibilities, dependencies, and write-isolation boundaries.
4. Define validation gates, runtime checks, return contracts, and caller-requested approval points.
5. Express the plan using the active environment's normal delegation mechanism.
6. Present the plan and stop.

Stop and ask when acceptance criteria are unverifiable or the needed validation gate is unavailable.

## Safety Rules

- Never execute the designed work, edit source, or dispatch a task.
- Never prescribe a delegation tool, mode, agent type, model, or vendor.
- Never delegate without a clear responsibility and expected result.
- Never design shared-write concurrency; isolate writers or serialize.
- Never weaken a failing validation gate to make the plan runnable.
- Never add coordination that the task's correctness does not require.

## Output Style

Report the chosen execution shape, responsibilities, task dependencies, gates, return contracts, assumptions, unresolved risks, and optional resource data when available.
