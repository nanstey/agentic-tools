---
name: idea-to-pr
description: Takes an idea from evidence-backed discovery through built, tested, and validated pull requests. Use when a feature idea or change request should be driven end-to-end to review-ready PRs.
user-invocable: true
disable-model-invocation: false
---

# Idea To PR

## Core Contract

The coordinating session owns user communication, scope and approval decisions, the plan-folder README state machine, work assignment, compact handoffs, supervision, and final reporting.

Use the active environment's available execution mechanisms. Work may run inline, through directly delegated tasks, through a managed workflow, or through bounded nested coordination when that is the supported model. Inspect available capabilities before designing the run; never assume tool names, agent types, model vendors, workflow modes, or invocation parameters.

Use the least coordination that preserves correctness. Keep one owner for global state and decisions even when execution is delegated. Preserve coordinator context by retaining only current state, decisions, and compact evidence packets; durable artifacts hold detailed findings and output. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The idea or change request.
2. Mode: `autopilot` (default) or `gated` (stop at plan and dependent-slice gates).
3. Constraints: deadline, execution budget, compatibility requirements, and optional skipped stages.
4. For a resumed run: the existing plan folder.

If the idea is too vague to classify or acceptance criteria cannot be derived, stop and ask. In autopilot, the initial invocation authorizes ordinary discovery, planning, implementation, validation, commits, and PR creation within the agreed scope.

## Orchestration Protocol

### Capability discovery

Inspect the current execution environment once at the start and record which capabilities exist:

- delegated task execution and cancellation;
- parallel read-only work;
- isolated workspaces for concurrent writers;
- role, tool, or model selection;
- time, cost, token, iteration, and fan-out limits;
- durable task output, traces, or artifact storage;
- blocking approval or checkpoint support.

Map the logical stages below onto those capabilities. If delegation is unavailable or adds more coordination than value, run that stage inline. Missing optional controls do not block the run: replace them with narrow scope, explicit stop conditions, and recorded limitations. Never invent unsupported controls or syntax.

### State and handoffs

Create or resume the plan-folder README as the pipeline state machine. Record stage status, execution approach, result or artifact path, decision, slice/PR status, and blocker after every transition.

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

- Put complete discovery findings, planning artifacts, command output, and screenshots in the plan folder or the available durable output store; link them from the README.
- Do not repeat broad repository output downstream. Each stage receives only its packet and required artifact paths.
- Require evidence for research and QA returns. Synthesis resolves duplicates and contradictions before planning instead of passing raw fan-out output onward.
- Never ask a later stage to rediscover settled facts. Run narrowly scoped supplemental reconnaissance when evidence is missing.

### Bounded supervision

Every delegated task needs a purpose, bounded scope, stop condition, required artifacts, deterministic gate where applicable, and concrete return contract. Set time, cost, token, iteration, and fan-out limits when supported.

Before dispatch, record the task, owner, expected result, validation gate, and artifact paths in the README. At return, inspect status, evidence, required artifacts, and gate results before advancing.

Treat a timed-out, partial, blocked, cancelled, artifact-less, or gate-failed task as a blocked stage. Make at most one narrower retry with fresh scope and an explicit stop condition; otherwise surface the evidence and stop. Keep reconnaissance bounded to relevant paths, targeted reads, and package metadata. Do not scan lockfiles or dependency directories as source evidence.

## Workflow

Resume at the first incomplete stage in the README rather than restarting.

### 1. Triage

Classify the request as **small** (one clear, low-risk component) or **large** (cross-boundary, risky, or product-ambiguous), extract acceptance criteria, and identify unresolved material questions. Delegate this only when a separate context would improve discovery.

### 2. Plan folder

Run `plan-init` to create the plan folder/README. For a resumed run, verify the README state and prepare the next stage packet.

### 3. Evidence and planning

#### 3a. Discovery

- **Small idea:** use one bounded reconnaissance task for the affected behaviour, files, tests, validation commands, and risks.
- **Large idea:** split distinct read-only scopes across product/request evidence, code patterns and boundaries, and validation/runtime risks when parallel execution is available. Follow with one synthesis step that emits a single evidence packet.
- Give every scope concrete paths, a strict evidence-bearing return contract, and an explicit tool or effort bound. Do not fan out overlapping questions.

#### 3b. Planning

Use the evidence packet rather than full raw findings:

- **Small:** run `proposal` and retain its artifact path plus decision packet.
- **Large:** run `product-review` → `system-architecture` → `program-design` → `vertical-slices` in order. Each stage receives the preceding compact artifact packet and writes its artifact to the plan folder.

Every planning handoff in autopilot includes: **“This is an `idea-to-pr` autopilot run. The user has authorized ordinary planning transitions. Write the assigned artifact, report material risks, and return control without requesting plan approval.”**

In `gated` mode, stop for explicit approval after the completed plan. In autopilot, proceed unless a material scope, safety, or design decision remains unresolved.

### 4. Specification

Run `speclist` to write one spec per slice under `<plan-folder>/specs/`. One slice equals one PR. Require each spec to contain:

- `## Implementation` — checked only after implementation validation passes.
- `## Test Scenarios` — Given/When/Then scenarios checked only after a separate QA/review step observes them pass.

### 5. Per-slice pipeline

For each slice, use the spec plus current decision packet. Dependent slices remain sequential. Concurrent writers require isolated workspaces; otherwise serialize them.

1. Run `branch` or `worktree` when the current checkout is unsuitable. Never run concurrent writers in one checkout.
2. Run a bounded environment preflight: detect the package manager/lockfile, run the prospective deterministic gate, and, only for a dependency-shaped failure, make one immutable-install repair (for pnpm, `pnpm install --frozen-lockfile`) and retry the identical gate. Record both attempts and classify persistent failure as baseline code, lockfile/install, access/service, or unknown.
3. Run `flow-design` when delegation would improve the slice. It inspects the active environment and returns the smallest supported execution plan, role boundaries, deterministic gate, pass contract, limits, and return contracts. For simple or non-delegated slices, record the equivalent plan inline.
4. Execute the plan. Separate implementation from acceptance review when an independent context is available; otherwise perform a distinct self-review pass and record that limitation. Only the implementation step checks completed `## Implementation` items.
5. For runnable behaviour, use a separate QA step to boot the app and observe every Given/When/Then scenario end-to-end. Use `playwright-cli` for browser-facing behaviour or equivalent CLI/API verification otherwise. QA returns per-scenario evidence and checks only `## Test Scenarios`; unit tests alone do not prove runtime behaviour.
6. For user-facing UI, run `visual-capture` only after QA passes. Store evidence outside git and hand its paths to the PR step.
7. For large changes or on request, run an independent quality review using `principles` and/or `deep-review`; route accepted fixes through a new bounded implementation step.
8. Run `commit`, then `pr`. Use `gh-stack` / `pr-restack` for dependent PRs. Update the README with the PR URL, status, evidence paths, and decision deviations.

**GATE (gated mode):** require user approval before the next dependent slice. Autopilot proceeds after successful ordinary transitions and stops only for an unresolved material decision, destructive or externally consequential action not already authorized, unavailable required access/service, or a blocked validation/runtime gate.

### 6. Close-out

Perform a final read-only audit that every slice is review-ready or merged, spec checkboxes have valid ownership/evidence, README state matches artifacts, and PR links exist. Delegate the audit when an independent execution context is available. Set `Status: done` only after it passes. When the run encountered avoidable friction, run `reflect` and offer its durable improvements.

## Safety Rules

- Never prescribe or fabricate a delegation API, workflow mode, agent type, model, vendor, or control that the active environment does not expose.
- Never delegate without bounded scope, a stop condition, required evidence or artifacts, and a concrete return contract.
- Never treat a timed-out, partial, cancelled, artifact-less, or gate-failed result as successful.
- Never use broad or unbounded discovery scans, scan lockfiles/dependency directories, or duplicate settled reconnaissance.
- Never proceed past the planning gate in `gated` mode without explicit approval.
- Never weaken a failing baseline gate, alter manifests/lockfiles, or skip the one bounded immutable-install retry for a dependency-shaped failure.
- Never advance a slice without deterministic validation and, where behaviour runs, observed runtime verification.
- Never let implementation check test scenarios or QA check implementation items; never tick an item without its required evidence.
- Never capture UI evidence before verified runtime behaviour, open a PR with unticked spec items, or run parallel writers in one checkout.
- Never let the README state or compact handoff packet drift from completed work artifacts.

## Output Style

Report a compact stage checklist (`done` / `skipped` / `blocked`), plan-folder path, current handoff packet location, execution assignments and artifact paths, limits and verdict per delegated task when available, slice status with PR URLs, and unresolved blockers or gates. Keep detailed task output in linked artifacts.
