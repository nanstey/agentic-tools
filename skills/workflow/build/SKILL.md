---
name: build
description: Implements scoped changes from context, plans, or speclists through verifiable phases with up-front success criteria and per-phase validation. Use when execution should start from existing requirements.
user-invocable: true
disable-model-invocation: false
---

# Build

## Core Contract

Execute one cohesive change as a sequence of individually verifiable phases, each with focused edits and validation.

Define success criteria before editing and advance only when the current phase's criteria pass. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Use the active environment's delegation mechanisms when a separate execution context improves discovery, implementation, or review. Keep small cohesive work inline. Run independent scopes concurrently only when writers are isolated, and let the environment choose its agents, models, and tools.

## Required Inputs

1. Source: a plan folder `README.md`, `context`, `plan`, or `speclist` (inline or filepath). If absent, derive a minimal plan from intent.
   - Given a plan-folder README: read it for the big picture, follow its `## Design` docs for context, and use each approved slice's `specs/NN-*.md` as its phase checklist. Default to one PR across all slices in one repository. Split only when the user requests multiple PRs or the change spans multiple repositories. Cross-repository work needs one PR per repository. Use `/pr stack` or `/pr restack` only for user-requested dependent PRs in one repository.
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour (BDD/TDD), not implementation details.
4. Required validation and the tooling/methods it depends on.
5. Constraints and delivery expectations (e.g. commit/PR).

## Workflow

1. Classify input, restate objective, and define behavioural success criteria up front.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/git branch` or `/git worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it.
4. Decompose into individually verifiable phases.
5. For each phase: implement focused edits, have a distinct validator step execute checks/observe success criteria, and update speclist checkboxes only after validation. Run `/git commit` only when shipping was requested.
6. When phases pass, perform the shared review handoff below. If shipping was requested, run `/pr` with its evidence/packet and inherited round state; otherwise stop with local results, no commit/push/PR. In a plan folder, record the actual slice `PR`/`Status` and top-level `Status`, distinguishing validated local work, draft publication, and review readiness.
7. If a design changes during implementation, update the affected `## Design` doc or spec and append a dated entry to the README `## Decision log`; keep the plan folder consistent with what shipped.
8. Summarize changes, validation, assumptions, and risks.

## Shared Review Handoff

Load [`risk-review`](../../code-quality/risk-review/SKILL.md) for read-only source review and the PR caller contract in [`gates.md`](../../dev/pr/references/gates.md). Supply acceptance criteria, observed outcomes with source/command citations, validator results and limitations, exact source base/head/scope, trusted policy, known impact paths/containment, and any prior packet/findings. Keep category separate from severity; unresolved verified requests block regardless of fix size. Nits and baseline-proven unchanged existing issues are nonblocking; uncertain baseline is a coverage gap.

Source reviewers read source without running tests or editing. Separate validators execute required checks; authorized implementers fix verified requests. Scale review depth through impact evidence, consequences, containment, uncertainty, and selected checks, never change size. Preserve separate contexts when available; model diversity is optional, unknown provenance never blocks, and main-model routing is unchanged. Disclose self-review/context limitations.

The build/orchestration caller owns one three-round review/fix budget including initial round 1, retained IDs/root causes/resolutions, and evidence snapshots. Both clean quality/security visits can share round 1. Every changed fix head consumes the next round; reserve it before edits and never create an unreviewable fourth head. Revalidate outcomes/required CI and review fix delta/affected paths; security fixes repeat affected quality/security too. Do not reset the budget when publishing or entering `/pr`/monitor/comment fixes. No-progress/unfixable requests, reviewer/check failures, exhausted rounds, or material evidence gaps stop blocked with a narrow fix/split/revert or owner decision as next action. Optional nits require separate explicit selection/authorization and never drive rounds.

Reuse packets only for exact matching authoritative PR base/head/policy/scope/check coverage and evidence snapshot. A prepublication/local-source packet is diagnostic until that correspondence is verified; changed heads require affected-path/check reassessment with applicable findings retained, and broad base/policy changes require full reassessment without a reset. Never request a duplicate full review of a matching packet.

Pass current outcome/check evidence and packet to `/pr`: outcome → expected independent required CI → quality → security → automated-review-dependent required CI → human readiness. A source-only clean result is not overall readiness. Every PR needs security triage and relevant deeper checks; critical new risk escalates at once. Green CI/PR prose is not outcome evidence, and zero observed checks is not success: discover actual expected policy/jobs, use supported draft/manual triggers or explicitly authorized configuration changes for ready-only jobs, otherwise blocked. Publication/human approval stay with orchestration; readiness never grants approval/merge authority or bypasses later jobs/queue/release policy.

## Safety Rules

- Never advance, `/git commit`, or `/pr` a phase whose success criteria are unvalidated.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never rely on validation tooling without first confirming it is available and runnable.
- Never `/git commit`, push, or `/pr` unless the request includes shipping; when it does, treat them as phase and completion steps.
- Never treat ambiguous intent as approval for broad refactors.
- Never delegate work without a clear purpose, relevant context, required evidence, and expected result.
- Never revert or overwrite unrelated user changes, or use destructive git/file operations, without explicit approval.
- Never let a plan folder drift from reality: update its README index and design docs when implementation diverges from the plan.

## Output Style

Report source/objective and per-phase success criteria/results, branch/worktree decision, validator commands/outcome evidence and limitations, assignments, files changed, packet snapshot/verdict/findings and inherited round state, commits/publication or local-only status, and blockers/next actions. Distinguish source review, draft publication, human readiness, and approval; never claim independent review without evidence.
