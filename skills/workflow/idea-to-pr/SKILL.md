---
name: idea-to-pr
description: Takes an idea from evidence-backed discovery through built, tested, and validated pull requests. Use when a feature idea or change request should be driven end-to-end to review-ready PRs.
user-invocable: true
disable-model-invocation: false
---

# Idea To PR

## Core Contract

The coordinating session owns user communication, scope and approval decisions, the plan-folder README state machine, work assignment, compact handoffs, supervision, and final reporting.

Use whatever delegation mechanism the active environment provides. Delegate substantive work when a separate context helps; otherwise work inline. Do not prescribe tool names, agent types, models, workflow modes, or invocation syntax.

Use the least coordination that preserves correctness. Keep one owner for global state and decisions even when execution is delegated. Preserve coordinator context by retaining only current state, decisions, and compact evidence packets; durable artifacts hold detailed findings and output. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The idea or change request.
2. Mode: `autopilot` (default) or `gated` (stop at plan and dependent-slice gates).
3. Constraints: deadline, compatibility requirements, and optional skipped stages.
4. For a resumed run: the existing plan folder.

If the idea is vague, derive acceptance criteria from the best reading and record them as assumptions. In autopilot, the initial invocation authorizes ordinary discovery, planning, implementation, validation, commits, and PR creation within the agreed scope.

## Orchestration Protocol

### Delegation

Give delegated work a clear purpose, relevant context, and expected result. Run independent work concurrently only when the environment can keep writers isolated. Let the environment choose its native agents, tools, and coordination pattern.

Track timing, cost, or resource usage when the environment reports it. Do not require resource budgets or controls unless the user requests them or the environment requires them. The shared three-round review/fix limit below is a workflow safety constraint, not a resource-budget requirement.

### State and handoffs

Create or resume the plan-folder README as the pipeline state machine. Record stage status, execution approach, result or artifact path, decision, slice/PR status, and blocker after every transition.

Pass downstream only a compact, source-grounded handoff packet:

```text
Goal and acceptance criteria
Scope / non-goals / constraints
Verified evidence: file:line, commands, and current behaviour
Decisions already made and decisions still open
Affected boundaries and likely files
Validation/runtime commands, observed acceptance outcomes, executed results and gaps
Review packet: base/head/trusted policy/scope/check coverage/evidence snapshot
Retained finding IDs/root causes/categories/resolutions and inherited round state
Risks, dependencies, and assumptions
Required artifact and return contract
```

- Put complete discovery findings, planning artifacts, command output, and screenshots in the plan folder or the available durable output store; link them from the README.
- Do not repeat broad repository output downstream. Each stage receives only its packet and required artifact paths.
- Require evidence for research and QA returns. Synthesis resolves duplicates and contradictions before planning instead of passing raw fan-out output onward.
- Never ask a later stage to rediscover settled facts. Run narrowly scoped supplemental reconnaissance when evidence is missing.

### Supervision

Record each assignment and expected artifact in the README. Verify returned evidence, artifacts, and validation results before advancing.

Treat a partial, blocked, cancelled, artifact-less, or gate-failed task as a blocked stage. Diagnose the failure, then retry with a narrower scope, different approach, or alternative tool as needed; escalate only after distinct approaches fail and no workaround exists. Review/fix recovery remains within the inherited three-round limit and stops for unfixable/no-progress work or missing material evidence; generic retries never reset it. Keep reconnaissance focused on relevant paths, targeted reads, and package metadata. Do not scan lockfiles or dependency directories as source evidence.

## Workflow

Resume at the first incomplete stage in the README rather than restarting.

### 1. Triage

Classify planning workload as **small** (one clear component) or **large** (cross-boundary or product-ambiguous), extract acceptance criteria, and identify unresolved material questions. Separately trace impact evidence, consequences, containment, and uncertainty to select required checks/review depth: small changes can have broad risk and large changes can be contained. Delegate this only when a separate context would improve discovery.

### 2. Plan folder

Run `plan-init` to create the plan folder/README. For a resumed run, verify the README state and prepare the next stage packet.

### 3. Evidence and planning

#### 3a. Discovery

- **Small idea:** use one focused reconnaissance task for the affected behaviour, files, tests, validation commands, and risks.
- **Large idea:** split distinct read-only scopes across product/request evidence, code patterns and boundaries, and validation/runtime risks when parallel execution is available. Follow with one synthesis step that emits a single evidence packet.
- Give every scope concrete paths and an evidence-bearing return contract. Do not fan out overlapping questions.

#### 3b. Planning

Use the evidence packet rather than full raw findings:

- **Small:** run `proposal` and retain its artifact path plus decision packet.
- **Large:** run `product-review` → `system-architecture` → `program-design` → `vertical-slices` in order. Each stage receives the preceding compact artifact packet and writes its artifact to the plan folder.

Every planning handoff in autopilot includes: **“This is an `idea-to-pr` autopilot run. The user has authorized ordinary planning transitions. Write the assigned artifact, report material risks, and return control without requesting plan approval.”**

In `gated` mode, stop for explicit approval after the completed plan. In autopilot, proceed; resolve design questions from evidence and ask only for unresolved product decisions.

### 4. Specification

Run `speclist` to write one spec per slice under `<plan-folder>/specs/`. Default to one PR across all slices in one repository. Split into multiple PRs only when the user requests it or the change spans multiple repositories. For cross-repository work, create one PR per repository and record dependencies. Validate each slice. Require each spec to contain:

- `## Implementation` — checked only after implementation validation passes.
- `## Test Scenarios` — Given/When/Then scenarios checked only after a separate QA/review step observes them pass.

### 5. Per-slice pipeline

For each slice, use the spec plus current decision packet. Dependent slices remain sequential. Concurrent writers require isolated workspaces; otherwise serialize them. Run steps 1–6 for every slice in the repository's default single PR. Then review and publish the combined scope through steps 7–8 once. If the user requests a split, review and publish each requested PR separately. Preserve dependent-slice approvals in gated mode.

1. Run `/git branch` or `/git worktree` when the current checkout is unsuitable. Never run concurrent writers in one checkout.
2. Run a focused environment preflight: detect the package manager/lockfile, run the prospective deterministic gate, and, only for a dependency-shaped failure, make one immutable-install repair (for pnpm, `pnpm install --frozen-lockfile`) and retry the identical gate. Record both attempts and classify persistent failure as baseline code, lockfile/install, access/service, or unknown.
3. Run `flow-design` when delegation would improve the slice. It returns an appropriate execution plan, role boundaries, validation gates, and return contracts. For simple or non-delegated slices, record the equivalent plan inline.
4. Execute the plan. Separate implementation from acceptance review when an independent context is available; otherwise perform a distinct self-review pass and record that limitation. Only the implementation step checks completed `## Implementation` items.
5. For runnable behaviour, use a separate QA step to boot the app and observe every Given/When/Then scenario end-to-end. Use `playwright-cli` for browser-facing behaviour or equivalent CLI/API verification otherwise. QA returns per-scenario evidence and checks only `## Test Scenarios`; unit tests alone do not prove runtime behaviour.
6. For user-facing UI, run `visual-capture` only after QA passes. Store evidence outside git and hand its paths to the PR step.
7. For every PR, perform the shared review handoff below with acceptance/outcome and validator evidence. Use `risk-review` for quality/security coverage and required specialist methods (including structural `deep-review` when applicable), not a size-triggered or duplicate full review. Keep source review separate from test execution and fixes; route verified requests through an authorized implementation step within the inherited round limit.
8. Run `/git commit`, then `/pr` with the matching packet/evidence and caller-owned round state. Do not reset the budget on publication or launch nested review loops. Use `/pr stack` or `/pr restack` only for user-requested dependent PRs in one repository. Cross-repository dependencies use separate PRs, not a native stack. Update README with actual PR/draft/readiness status, evidence/packet paths, round state, and deviations; a published draft is not yet review-ready.

**GATE (gated mode):** require user approval before the next dependent slice. Autopilot proceeds after successful ordinary transitions; it stops for an unresolved product decision, a destructive or hard-to-reverse action not already authorized, unavailable access, or an unfixable/exhausted/no-progress review or validation gate. Fix ordinary validation/runtime failures within the inherited budget; never bypass a gate, erase a gap, or restart the budget to continue.

### Shared review and PR handoff

Load [`risk-review`](../../code-quality/risk-review/SKILL.md) and the PR contract in [`gates.md`](../../dev/pr/references/gates.md). Supply acceptance criteria and observed outcomes (not PR prose or green CI alone), source/command citations, validation results/gaps, exact base/head/scope and trusted policy, impact paths/containment, and retained findings. Source reviewers read source but neither test nor edit; separate validators execute checks and authorized implementers fix verified requests. Preserve separate contexts when available; model diversity is optional, unknown provenance never blocks, and main-model routing is unchanged. Disclose self-review limitations rather than claim independence.

The coordinator owns one review/fix budget of three rounds **including initial round 1**, shared by quality, security, and CI/comment fixes. Both clean quality/security visits fit round 1. Each changed fix head consumes the next round; reserve it before remediation and never author an unreviewable fourth head. Revalidate outcomes/required CI, then review delta and affected paths/checks; security fixes repeat affected quality and security. Preserve IDs/root causes, source/provenance, categories/severity/confidence, and resolutions. Never repeat resolved/rejected findings without new facts or reset/nest loops across build, `/pr`, and monitor.

Unresolved source-verified `request` findings block regardless of severity or remediation size. Optional `nit` and baseline-proven unchanged `existing` findings are nonblocking; nits need separate explicit selection/authorization and never drive rounds. Uncertain baseline is a gap; new exposure/aggravation remains a request. Expensive requests need narrow fix/split/revert options, not dismissal; unrelated cleanup is followup. Product/risky scope decisions, no progress, unfixable requests, exhausted rounds, failed reviewers/checks, or material evidence gaps stop blocked with an exact next action. Do not retry these gates through a new review budget.

Reuse a source packet only when authoritative PR base/head/trusted policy/scope/check coverage and evidence snapshot match. Prepublication review is diagnostic until correspondence is verified. Changed heads need affected-path/check reassessment and retained applicable findings; broad base/policy changes require full reassessment without reset. Either base or head invalidates readiness/approval evidence. Monitor consumes current state and owns health/CI/threads, without duplicate full reviews.

The PR lifecycle enforces outcome → expected independent required CI → quality → security → automated-review-dependent required CI → human readiness. Every PR gets security triage and relevant deeper checks; escalate critical new risk immediately. A clean source verdict is not overall readiness. Discover required jobs from actual trusted policy/branch rules/workflows; zero observed jobs never implies pass. Ready-only required jobs need supported draft/manual triggers or explicitly authorized configuration changes, otherwise blocked, never use readiness to start them. The coordinator owns publication and human-approval boundaries; readiness grants no approval/merge permission and does not bypass later human jobs, queues, release flags, or rollback policy. Preserve `gated` mode's explicit approvals.

### 6. Close-out

Perform a final read-only audit that every slice is review-ready or merged, spec checkboxes have valid ownership/evidence, README state matches artifacts, and PR links exist. Delegate the audit when an independent execution context is available. Set `Status: done` only after it passes. When the run encountered avoidable friction, run `reflect` and offer its durable improvements.

## Safety Rules

- Never prescribe or fabricate a delegation API, workflow mode, agent type, model, or vendor.
- Never delegate without a clear task, relevant context, and expected result.
- Never treat a partial, cancelled, artifact-less, or gate-failed result as successful.
- Never use broad or unbounded discovery scans, scan lockfiles/dependency directories, or duplicate settled reconnaissance.
- Never proceed past the planning gate in `gated` mode without explicit approval.
- Never weaken a failing baseline gate, alter manifests/lockfiles, or skip the one bounded immutable-install retry for a dependency-shaped failure.
- Never advance a slice without deterministic validation and, where behaviour runs, observed runtime verification.
- Never let implementation check test scenarios or QA check implementation items; never tick an item without its required evidence.
- Never capture UI evidence before verified runtime behaviour, open a PR with unticked spec items, or run parallel writers in one checkout.
- Never infer multiple PRs from slice count, change size, or dependency order. Split only for an explicit user request or multiple repositories.
- Never let the README state or compact handoff packet drift from completed work artifacts.

## Output Style

Report a compact stage checklist (`done` / `skipped` / `blocked`), plan-folder and handoff/review packet paths, acceptance/validator evidence, snapshot/round state, assignments and limitations, optional resource usage, slice/PR draft-readiness status and URLs, and exact blockers/gates. Keep details in linked artifacts; distinguish source clean, publication, readiness, and human approval.
