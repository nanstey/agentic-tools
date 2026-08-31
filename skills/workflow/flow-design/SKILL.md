---
name: flow-design
description: Designs a bounded, platform-neutral delegation plan with roles, gates, budgets, and return contracts. Use when a task needs coordinated execution designed before work begins.
user-invocable: true
disable-model-invocation: false
---

# Flow Design

## Core Contract

Turn one task into a concrete, bounded execution plan using only the delegation capabilities exposed by the active environment. Define role boundaries, ordering, isolation, deterministic gates, limits, and return contracts without assuming a tool name, agent API, workflow mode, model vendor, or parameter schema.

Design-only: never execute the plan, edit source, or dispatch work. The caller (a user, `idea-to-pr`, or `build`) executes it. A bounded validation-environment preflight is allowed because it verifies a proposed gate rather than executing the task.

Inspect the current environment's delegation documentation or available tool surface before choosing an approach. If delegation is unavailable or unnecessary, design an inline execution sequence instead. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task: outcome, boundaries, and acceptance criteria.
2. Validation tooling available (test command, linter, typecheck, E2E runner, how to boot the app).
3. Constraints: budget ceiling, timeout expectations, and approval points.
4. Whether the task writes to the repo, and whether independent writers are plausible.

If acceptance criteria are absent and cannot be derived from the task, stop and ask.

## Design Rules

### Capability discovery

Record whether the active environment supports:

- delegated tasks and cancellation;
- parallel execution;
- isolated workspaces;
- role, tool, or model selection;
- time, cost, token, iteration, and fan-out limits;
- durable outputs or traces;
- approval checkpoints.

Design only with confirmed capabilities. Express logical roles and contracts first, then map them to the available invocation syntax.

### Least coordination first

Escalate only when it changes correctness:

- Parent can complete the task reliably → inline execution; no delegation.
- One bounded lookup or isolated change → one delegated task.
- Independent read-only scopes → parallel tasks when supported.
- Consequential change needing acceptance review → implementation plus an independent verifier when a separate context is available.
- Ordered phases, persisted artifacts, or approval points → a sequential workflow or coordinator-managed sequence.
- Independent writers → isolated workspaces plus an integration owner; otherwise serialize.
- Multi-source research → scoped fan-out followed by one synthesis owner.

Every delegated task needs a one-sentence purpose.

### Role selection

- Assign roles by responsibility: discovery, implementation, integration, review, or runtime QA.
- Match available capability to task difficulty. Do not require a named model, tier, vendor, or built-in agent type.
- Prefer an independent context for consequential review. If the environment cannot provide one, require a separate self-review pass and record the limitation.
- Keep one owner for shared state, cross-task decisions, and final integration. Use nested delegation only when the environment requires or supports it, with explicit ownership and depth limits.

### Gates and limits

- Attach a deterministic validation command to every phase that produces code; confirm it is runnable before including it.
- On a dependency-shaped preflight failure, detect the lockfile/package manager, perform one immutable install (for pnpm, `pnpm install --frozen-lockfile`), and retry the identical command once. Preserve manifests, lockfiles, and gate scope. Classify a persistent failure as code, lockfile/install, access/service, or unknown.
- For runnable behaviour, include a runtime verification step that boots the app and exercises the acceptance scenarios. Unit tests alone are insufficient.
- Set supported time, cost, token, iteration, and fan-out limits. Where a control is unavailable, substitute narrow scope and an explicit stop condition.
- State acceptance criteria and required evidence in each return contract.
- Add human approval points only when the caller requested them. An `idea-to-pr` autopilot handoff authorizes ordinary planning and execution transitions.
- With a spec checklist, implementation owns `## Implementation` items and QA/review owns `## Test Scenarios`. A read-only verifier returns per-scenario evidence for the caller to record.
- Keep concurrent writers out of a shared checkout.

## Workflow

1. Restate the task, acceptance criteria, and whether it writes to the repo.
2. Inspect and record the active environment's available delegation and control capabilities.
3. Probe the prospective validation gate. Perform the bounded immutable-install repair and retry for a dependency-shaped failure.
4. Choose the least-coordination execution shape and record why a simpler shape is insufficient.
5. Assign responsibilities and isolation boundaries using only supported capabilities.
6. Define deterministic gates, runtime checks, return contracts, limits, stop conditions, and caller-requested approval points.
7. Write the logical execution plan, then include environment-specific invocations only when confirmed from the active tool surface.
8. Present the plan and stop.

Stop and ask when acceptance criteria are unverifiable, the needed gate is unavailable after preflight, or the caller has not supplied a necessary budget limit for an expensive execution shape.

## Safety Rules

- Never execute the designed work, edit source, or dispatch a task.
- Never assume or invent a delegation tool, mode, agent type, model, vendor, or parameter.
- Never omit purpose, scope, stop conditions, evidence, and return contracts from delegated tasks.
- Never leave supported iteration, fan-out, time, or spend controls unbounded for implementation work.
- Never design shared-write concurrency; isolate writers or serialize.
- Never weaken, narrow, or substitute a failing baseline gate to make the plan runnable.
- Never request approval for an ordinary execution choice when the caller supplied autopilot authorization.
- Never add coordination that the task's correctness does not require.

## Output Style

Report the chosen execution shape with one-line justification, a role-to-responsibility table, the logical task graph, confirmed environment-specific invocations when available, gates, limits, return contracts, assumptions, and unresolved risks.
