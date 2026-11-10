---
name: idea-to-pr
description: Takes an idea from evidence-backed discovery through a built, tested, and validated pull request. Use when a feature idea or change request should be driven end-to-end to a review-ready PR.
user-invocable: true
disable-model-invocation: false
---

# Idea To PR

## Core Contract

The coordinating session owns user communication, scope and approval decisions, run-report state, work assignment, compact handoffs, supervision, and final reporting.

Use whatever delegation mechanism the active environment provides. Delegate substantive work when a separate context helps; otherwise work inline. Do not prescribe tool names, agent types, models, workflow modes, or invocation syntax.

Use the least coordination that preserves correctness. Keep one owner for global state and decisions even when execution is delegated. Preserve coordinator context by retaining only current state, decisions, and compact evidence packets; durable artifacts hold detailed findings and output. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The idea or change request.
2. Mode: `autopilot` (default) or `gated` (stop at the plan-approval gate).
3. Constraints: deadline, compatibility requirements, and optional skipped stages.
4. For a resumed run: the existing plan file.

If the idea is vague, derive acceptance criteria from the best reading and record them as assumptions. In autopilot, the initial invocation authorizes ordinary discovery, planning, implementation, validation, commits, and PR creation within the agreed scope.

## Orchestration Protocol

### Delegation

Give delegated work a clear purpose, relevant context, and expected result. Run independent work concurrently only when the environment can keep writers isolated. Let the environment choose its native agents, tools, and coordination pattern.

Track timing, cost, or resource usage when the environment reports it. Do not require resource budgets or controls unless the user requests them or the environment requires them. The per-invocation review/fix limit in the `pr` skill's `references/gates.md` is a workflow safety constraint, not a resource-budget requirement.

### State and handoffs

Track stage status, execution approach, result or artifact path, decision, PR status, and blocker in the run report or handoff packet after every transition.

Pass downstream only a compact, source-grounded handoff packet:

```text
Goal and acceptance criteria
Scope / non-goals / constraints
Verified evidence: file:line, commands, and current behaviour
Decisions already made and decisions still open
Affected boundaries and likely files
Validation/runtime commands, observed acceptance outcomes, executed results and gaps
Review packet: base/head/trusted policy/scope/check coverage/evidence snapshot
Retained finding IDs/root causes/categories/resolutions and invocation-scoped round state
Risks, dependencies, and assumptions
Required artifact and return contract
```

- Put complete discovery findings, planning artifacts, command output, and screenshots in the available durable output store. Link their paths from the packet.
- Do not repeat broad repository output downstream. Each stage receives only its packet and required artifact paths.
- Require evidence for research and QA returns. Synthesis resolves duplicates and contradictions before planning instead of passing raw fan-out output onward.
- Never ask a later stage to rediscover settled facts. Run narrowly scoped supplemental reconnaissance when evidence is missing.

### Supervision

Record each assignment and expected artifact in the run report or handoff packet. Verify returned evidence, artifacts, and validation results before advancing.

Treat a partial, blocked, cancelled, artifact-less, or gate-failed task as a blocked stage. Diagnose the failure, then retry with a narrower scope, different approach, or alternative tool as needed; escalate only after distinct approaches fail and no workaround exists. Review/fix recovery remains within its invocation's five-round limit and stops for unfixable/no-progress work or missing material evidence; generic retries never reset it within that invocation. Keep reconnaissance focused on relevant paths, targeted reads, and package metadata. Do not scan lockfiles or dependency directories as source evidence.

## Workflow

Resume from the existing plan file and the first incomplete stage in its handoff packet rather than restarting.

### 1. Triage

Extract acceptance criteria and identify unresolved material questions. Trace impact evidence, consequences, containment, and uncertainty to select required checks/review depth: narrow changes can have broad risk and broad changes can be contained. `planning` sizes the planning workload itself. Delegate this only when a separate context would improve discovery.

### 2. Discovery

- **Narrow idea (one clear component):** use one focused reconnaissance task for the affected behaviour, files, tests, validation commands, and risks.
- **Broad idea (cross-boundary or product-ambiguous):** split distinct read-only scopes across product/request evidence, code patterns and boundaries, and validation/runtime risks when parallel execution is available. Follow with one synthesis step that emits a single evidence packet.
- Give every scope concrete paths and an evidence-bearing return contract. Do not fan out overlapping questions.
- For underspecified ideas, run `scrutiny` Mode A's pre-build contract before fixing criteria. Only user-confirmed items become obligations; retain assumptions and unresolved decisions as evidence.

### 3. Planning

Run `planning` with the evidence packet rather than full raw findings. Require a plan file even for a trivial effort; it is written under its Plan Location rules. Retain the plan path plus the decision packet; the run report or handoff packet, not a plan index, tracks pipeline state.

In autopilot, state in the handoff: **“This is an `idea-to-pr` autopilot run. The user has authorized ordinary planning transitions.”** `planning` then returns the plan to the coordinator, which proceeds; resolve design questions from evidence and ask only for unresolved product decisions. In `gated` mode, omit that statement so `planning` stops for explicit approval.

### 4. Build pass

Use the approved plan and current decision packet for one cohesive build pass. The repository's default is one PR for the whole effort. The builder chooses internal phases from the plan's **Approach** and **Acceptance**.

1. Run a focused environment preflight: detect the package manager/lockfile, run the prospective deterministic gate, and, only for a dependency-shaped failure, make one immutable-install repair (for pnpm, `pnpm install --frozen-lockfile`) and retry the identical gate. Record both attempts and classify persistent failure as baseline code, lockfile/install, access/service, or unknown.
2. Run `flow-design` when delegation would improve the effort. For simple or non-delegated work, record the equivalent plan inline.
3. Run `build` steps 1–5 against the plan. Build covers branch/worktree fitness, tooling checks, internally phased implementation, and separate validation. Record validation evidence against each Acceptance item. Separate implementation from acceptance review when an independent context is available; otherwise record the limitation.
4. For runnable behaviour, use a separate QA step to boot the app and observe every Acceptance item end-to-end. Use `playwright-cli` for browser-facing behaviour or equivalent CLI/API verification otherwise. QA returns per-item evidence; unit tests alone do not prove runtime behaviour. Tick evidence in the plan only when repository policy tracks plans, otherwise record it in the packet.
5. For user-facing UI, run `visual-capture` only after QA passes. Store evidence outside git and hand its paths to the PR step.
6. The coordinator is the review caller and owns the round budget. Start review with one `/review-code fix` call on the combined scope per the `review-code` skill's `references/caller-contract.md`. Include QA evidence.
7. After successful validation, run `/git commit`, then `/pr` with the resulting packet, findings, and evidence. Update the run report with actual PR/draft/readiness status, evidence paths, round state, and deviations; a published draft is not yet review-ready. When a later fix or rebase changes an already-open non-draft PR, convert it back to draft first per the draft-before-changes rule in the `pr` skill's `references/gates.md`.

**GATE (gated mode):** require user approval after planning before the build pass. Autopilot proceeds after successful ordinary transitions; it stops for an unresolved product decision, a destructive or hard-to-reverse action not already authorized, unavailable access, or an unfixable/exhausted/no-progress review or validation gate. Fix ordinary validation/runtime failures within the invoking action's limit; never bypass a gate, erase a gap, or restart that limit within its invocation to continue.

### 5. Close-out

Perform a final read-only audit that every Acceptance item has valid ownership and evidence, the plan and handoff packet match what shipped, and the PR link exists. Delegate the audit when an independent execution context is available. Set `Status: done` only after it passes. When the run encountered avoidable friction, run `reflect` and offer its durable improvements.

## Safety Rules

- Never prescribe or fabricate a delegation API, workflow mode, agent type, model, or vendor.
- Never delegate without a clear task, relevant context, and expected result.
- Never treat a partial, cancelled, artifact-less, or gate-failed result as successful.
- Never use broad or unbounded discovery scans, scan lockfiles/dependency directories, or duplicate settled reconnaissance.
- Never proceed past the planning gate in `gated` mode without explicit approval.
- Never weaken a failing baseline gate, alter manifests/lockfiles, or skip the one bounded immutable-install retry for a dependency-shaped failure.
- Never advance work without deterministic validation and, where behaviour runs, observed runtime verification.
- Never tick an Acceptance item without its required evidence.
- Never capture UI evidence before verified runtime behaviour, open a PR with unverified Acceptance items, or run parallel writers in one checkout.
- Never let the handoff packet drift from completed work artifacts.

## Output Style

Report a compact stage checklist (`done` / `skipped` / `blocked`), plan and handoff/review packet paths, Acceptance/validator evidence, snapshot/round state, assignments and limitations, optional resource usage, PR draft-readiness status and URL, and exact blockers/gates. Keep details in linked artifacts; distinguish source clean, publication, readiness, and human approval.
