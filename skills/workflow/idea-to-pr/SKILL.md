---
name: idea-to-pr
description: Takes an idea from evidence-backed discovery through built, tested, and validated pull requests using pi-flows. Use when a feature idea or change request should be driven end-to-end to review-ready PRs.
user-invocable: true
disable-model-invocation: false
---

# Idea To PR

## Core Contract

The top-level session is the pipeline orchestrator. It owns user communication, scope and approval decisions, the plan-folder README state machine, flow dispatch, compact handoffs, runtime supervision, and final reporting. It does not perform repository surveys, planning, implementation, review, or PR work itself.

Delegate every substantive stage through bounded `pi-flows` calls: discovery, evidence synthesis, planning, specification, slice implementation, review, runtime QA, commits, and PR preparation. A flow worker may use the named skill needed for its assigned stage, but must not spawn another flow. The orchestrator invokes every flow directly and remains the sole coordinator.

Use the smallest flow that meets the stage's need. Preserve the orchestrator's context by retaining only the current state, decisions, and compact evidence packets; flow outputs and trace artifacts are the durable detailed record. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The idea or change request.
2. Mode: `autopilot` (default) or `gated` (stop at plan and dependent-slice gates).
3. Constraints: deadline, delegated-flow budget ceiling, compatibility requirements, and optional skipped stages.
4. For a resumed run: the existing plan folder.

If the idea is too vague to classify or acceptance criteria cannot be derived, stop and ask. In autopilot, the initial invocation authorizes ordinary discovery, planning, implementation, validation, commits, and PR creation within the agreed scope.

## Orchestration Protocol

### State and handoffs

Create or resume the plan-folder README as the pipeline state machine. Record stage status, selected flow mode, trace path, flow result, decision, slice/PR status, and blocker after every transition.

Pass downstream only a compact, source-grounded handoff packet:

```text
Goal and acceptance criteria
Scope / non-goals / constraints
Verified evidence: file:line, commands, and current behaviour
Decisions already made and decisions still open
Affected boundaries and likely files
Validation and runtime-verification commands
Risks, dependencies, and assumptions
Required artifact and return contract
```

- Put complete discovery findings, planning artifacts, command output, and screenshots in the plan folder or the flow trace; link them from the README.
- Do not paste broad repository output into the orchestrator context or repeat it to later workers. Each receiving flow gets only the packet and the artifact paths it needs.
- Require evidence for research and QA returns. Synthesis flows resolve duplicates and contradictions before planning; they do not pass raw fan-out output downstream.
- Never ask a later worker to rediscover settled facts. If its task needs missing evidence, run a narrowly scoped supplemental reconnaissance flow.

### Bounded runtime supervision

Every flow call must set a `why`, `timeoutMs`, `maxCostUsd` or `maxTokens`, a stage-specific `traceFile`, and `traceLabel`. Also set bounded fan-out/iteration limits for any mode that supports them. Use a timeout sized to the task, never an unbounded wait.

Before each dispatch, record its start time, expected completion window, agent roles, deterministic gate, and artifact paths in the README. At return, inspect the flow status, elapsed time, budget/usage, verdicts, trace output, and required artifacts before advancing.

Treat a timeout, partial or blocked envelope, missing required artifact, exhausted budget, failed deterministic gate, or absent trace/result as a blocked stage. Do not continue on stale or incomplete findings. Make at most one narrower retry with a fresh scope, lower tool/flow budget, and an explicit stop condition; otherwise surface the evidence and stop. Never use recursive scans, lockfiles, or dependency directories for reconnaissance; prefer bounded paths, targeted reads, and package metadata.

## Workflow

Resume at the first incomplete stage in the README rather than restarting.

### 1. Triage flow

Dispatch a bounded `single` flow to classify the request as **small** (one clear, low-risk component) or **large** (cross-boundary, risky, or product-ambiguous), extract acceptance criteria, and identify unresolved material questions. The top-level session records and communicates the classification; it does not independently inspect the codebase.

### 2. Plan folder flow

Dispatch a worker to run `plan-init` and create the plan folder/README. For a resumed run, dispatch a read-only worker to verify the README state and return the next stage packet.

### 3. Evidence and planning flows

#### 3a. Discovery

- **Small idea:** run one bounded `single` `recon` flow for only the affected behaviour, files, tests, validation commands, and risks.
- **Large idea:** run a bounded `dossier` or `parallel` flow with distinct read-only scopes: product/request, code patterns and boundaries, and validation/runtime risks. Follow it with a separate `debrief` synthesis flow that emits one evidence packet.
- Use `tier: fast` for mechanical reconnaissance. Set concrete paths, a strict return contract, `requireEvidence: true`, a short timeout, and an explicit tool budget. Do not fan out overlapping questions.

#### 3b. Planning

Dispatch planning through flows using the evidence packet, not the full raw findings:

- **Small:** a `single` planning worker runs `proposal` and returns its artifact path plus a decision packet.
- **Large:** a sequential `workflow` delegates `product-review` → `system-architecture` → `program-design` → `vertical-slices`. Each phase receives the preceding compact artifact packet and writes its artifact to the plan folder.

Every planning handoff in autopilot includes: **“This is an `idea-to-pr` autopilot run. The user has authorized ordinary planning transitions. Write the assigned artifact, report material risks, and return control to the orchestrator without requesting plan approval.”**

In `gated` mode, stop for explicit approval after the completed plan. In autopilot, proceed unless a material scope, safety, or design decision remains unresolved.

### 4. Specification flow

Dispatch `speclist` through a flow to write one spec per slice under `<plan-folder>/specs/`. One slice equals one PR. Require each spec to contain:

- `## Implementation` — build items, checked only by the implementation worker after its validation passes.
- `## Test Scenarios` — Given/When/Then scenarios, checked only by the QA/reviewer role after observing them pass.

### 5. Per-slice flow pipeline

For each slice, use the spec plus current decision packet. Dependent slices remain sequential; genuinely independent writers use isolated worktrees.

1. Dispatch `branch` or `worktree` through a flow. Never run concurrent writers in one checkout.
2. Dispatch a bounded environment-preflight worker: detect package manager/lockfile, run the prospective deterministic gate, and, only for a dependency-shaped failure, make one immutable-install repair (for pnpm, `pnpm install --frozen-lockfile`) and retry the identical gate. Return both attempts and classify persistent failure as baseline code, lockfile/install, access/service, or unknown.
3. Dispatch `flow-design` through a flow. It must inspect the available pi-flows surface, select the least-coordination execution mode, name the selected roles/tiers, set a deterministic `checkCommand`, concrete `passContract`, iteration cap, timeout, and spend ceiling. It must not execute the design.
4. The orchestrator validates the design contract, then executes its flow. Use `evaluate` by default for a code slice: an implementation operator, an independent critic, the repaired deterministic gate, and explicit caps. The implementation worker checks only completed `## Implementation` items.
5. For runnable behaviour, dispatch a separate QA flow to boot the app and observe every Given/When/Then scenario end-to-end. Use `playwright-cli` for browser-facing behaviour or equivalent CLI/API verification otherwise. QA returns per-scenario evidence and checks only `## Test Scenarios`; it must never infer success from unit tests. If a route body is mocked for Playwright, require `--content-type=application/json`.
6. For user-facing UI, dispatch `visual-capture` only after QA passes. Store evidence outside git and hand its paths to the PR flow.
7. For large changes (or on request), dispatch an independent quality-review flow using `principles` and/or `deep-review`; route accepted fixes through a new bounded implementation evaluation flow.
8. Dispatch `commit`, then `pr` through flows. Use `gh-stack` / `pr-restack` through a flow for dependent PRs. Update the README with the PR URL, status, evidence paths, and decision deviations.

**GATE (gated mode):** require user approval before the next dependent slice. Autopilot proceeds after ordinary successful transitions and stops only for an unresolved material decision, destructive or externally consequential action not already authorized, unavailable required access/service, or a blocked validation/runtime gate.

### 6. Close-out flow

Dispatch a final read-only audit flow to verify that every slice is review-ready or merged, spec checkboxes have valid ownership/evidence, README state matches flow artifacts, and PR links exist. Set `Status: done` only after it passes. When the run encountered avoidable friction, dispatch `reflect` through a flow and offer its durable improvements.

## Safety Rules

- Never perform substantive repository, planning, implementation, review, QA, commit, or PR work in the top-level session; dispatch a bounded pi-flows worker instead.
- Never delegate a worker that may itself dispatch flows; the top-level session is the sole flow orchestrator.
- Never allow a flow call without `why`, timeout, budget ceiling, trace path/label, bounded iteration/fan-out where applicable, and a concrete return contract.
- Never treat a timed-out, partial, budget-exhausted, trace-less, artifact-less, or gate-failed flow as successful.
- Never use broad or unbounded discovery scans, scan lockfiles/dependency directories, or duplicate already-settled reconnaissance.
- Never proceed past the planning gate in `gated` mode without explicit approval.
- Never weaken a failing baseline gate, alter manifests/lockfiles, or skip the one bounded immutable-install retry for a dependency-shaped failure.
- Never advance a slice without passing deterministic validation and, where behaviour runs, observed runtime verification.
- Never let the implementation worker check test scenarios or let QA check implementation items; never tick an item without the required evidence.
- Never capture UI evidence before verified runtime behaviour, open a PR with unticked spec items, or run parallel writers in one checkout.
- Never let the README state or compact handoff packet drift from the completed flow artifacts.

## Output Style

Report a compact stage checklist (`done` / `skipped` / `blocked`), plan-folder path, current handoff packet location, flow assignments and trace paths, elapsed time/budget/verdict per flow, slice status with PR URLs, and unresolved blockers or gates. Keep detailed flow output in linked artifacts, not the top-level report.
