---
name: flow-design
description: Designs a bounded pi-flows delegation plan for a task, selecting mode, agents, model tiers and vendors, gates, and budgets. Use when a task should be executed through pi-flows and needs the flow call designed before anything runs.
user-invocable: true
disable-model-invocation: false
---

# Flow Design

## Core Contract

Turn one task into a concrete, bounded pi-flows delegation plan: the mode, agent roles, per-role model choices, deterministic gates, budgets, and the exact `flow` call(s) ready to execute.
Design-only: never execute the designed flow, edit source, or spawn children. The caller (a user, `idea-to-pr`, or `build`) executes the plan.
Ground every choice in the installed pi-flows contract (`flow list:true` / `showConfig:true` and the flow reference); never design against modes, agents, or parameters that are not available.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The task: outcome, boundaries, and acceptance criteria.
2. Validation tooling available (test command, linter, typecheck, E2E harness, how to boot the app) for deterministic and runtime gates.
3. Constraints: budget ceiling, timeout expectations, approval points.
4. Whether the task writes to the repo, and if parallel writers are plausible.

If acceptance criteria are absent and cannot be derived from the task, stop and ask.

## Design Rules

### Least coordination first

Match the flow reference's activation thresholds. Escalate only when it materially changes correctness:

- Parent can do it reliably → **no flow**; say so and stop.
- One bounded read-only lookup → `single` with `recon`/`analyst`.
- Independent read-only areas → `parallel`.
- A change that must be verified before acceptance → `evaluate` (default for implementation tasks).
- Named phases, persisted artifacts, or a human approval point → `workflow`.
- Genuinely independent writers needing a verified integration branch → `worktree`.
- Multi-source evidence reconciliation → `dossier`; decompose-and-synthesize research → `orchestrate`.

Every spawning call needs a one-sentence `why`; write it into the plan.

### Model selection policy

Right-size the model to each role, and split vendors between author and judge:

- **Building / generating (operator, workers, integrator): Anthropic** models.
- **Reviewing / QA / critique (redteam, overwatch, verify, judges, scorers): OpenAI Codex** models.
- Prefer `tier` for sizing (`fast` for mechanical or extraction work, `capable` for standard implementation, `deep` for hard reasoning, architecture, or final critique); pin an exact `model` only where the vendor split or a named model is the point.
- Never let the same vendor both author and solely judge a consequential artifact; a critic panel may mix vendors, but at least one critic must be non-Anthropic when the operator is Anthropic.

### Gates and budgets

- Attach a deterministic `checkCommand` (tests, typecheck, lint) to every `evaluate` and to workflow phases that produce code; confirm the command is runnable before designing it in.
- When the task changes runnable behaviour, unit tests alone are not an adequate gate: design a runtime verification stage that boots the app and exercises the acceptance scenarios against it — an E2E `checkCommand` (e.g. a Playwright test run) when one exists, otherwise a `workflow` phase or caller-owned step that drives the running app via `playwright-cli` or equivalent. Name which acceptance criteria the runtime stage proves.
- Cap iteration (`maxIterations`), fan-out, and spend (`maxCostUsd` or `maxTokens`) explicitly; never leave an implementation flow uncapped.
- State `passContract` acceptance criteria concretely; vague criteria make critic verdicts unreliable.
- Place human `checkpoint` / workflow `approval` nodes where the caller declared approval points.
- Keep concurrent writers out of a shared `cwd`; use `worktree` mode or sequential execution instead of `allowSharedWriteCwd`.

## Workflow

1. Restate the task, its acceptance criteria, and whether it writes to the repo.
2. Inspect the installed pi-flows surface (`list`, `showConfig`) for available agents, tiers, caps, and any user/project custom agents.
3. Pick the least-coordination mode per the design rules; record why simpler modes were rejected.
4. Assign agents and models per role using the model selection policy.
5. Define gates: `checkCommand`, `passContract`, iteration caps, budgets, and any approval points.
6. Write the plan: the exact `flow` call JSON (or ordered calls), each with its `why`, plus a short rationale table (role → agent → tier/model → vendor → reason).
7. Present the plan and stop; do not execute it.

Stop and ask when acceptance criteria are unverifiable, the needed gate command is unavailable, or budget expectations are unknown for an expensive mode (`worktree`, `orchestrate`, `debate`).

## Safety Rules

- Never execute the designed flow or spawn any child; output is the plan only.
- Never design a mode, agent, or parameter not confirmed available in the installed pi-flows.
- Never omit `why`, iteration caps, or a spend ceiling from an implementation flow.
- Never assign the same vendor as both sole author and sole judge of an artifact.
- Never design shared-write concurrency; isolate writers or serialize.
- Never escalate coordination beyond what the task's correctness requires.

## Output Style

Report: chosen mode with one-line justification, the role/model rationale table, the exact `flow` call JSON ready to run, gates and budgets, and any assumptions or unresolved risks. Terse; no filler.
