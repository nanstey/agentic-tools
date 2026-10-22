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
   - Given a plan-folder README: read it for the big picture, follow its `## Design` docs for context, and use each approved slice's `specs/NN-*.md` as its phase checklist. Follow the PR split rule in the [caller contract](../review-code/references/caller-contract.md).
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour (BDD/TDD), not implementation details.
4. Required validation and the tooling/methods it depends on.
5. Constraints and delivery expectations (e.g. commit/PR).

## Workflow

1. Restate the objective and behavioural success criteria. For underspecified requests, run [scrutiny](../../code-quality/scrutiny/SKILL.md) Mode A's pre-build contract first. Only user-confirmed items become obligations; retain assumptions and unresolved decisions as evidence.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/git branch` or `/git worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it.
4. Decompose into individually verifiable phases.
5. For each phase: implement focused edits, have a distinct validator step execute checks/observe success criteria, and update speclist checkboxes only after validation. Run `/git commit` only when shipping was requested.
   After a phase passes validation, run [`complexity`](../../code-quality/complexity/SKILL.md) `--changed` on the code you wrote. Simplify a function in the Refactor band that you changed, then re-validate. Treat a Review-band function as a note. If Lizard is unavailable, record the gap and continue.
6. When a caller such as `idea-to-pr` states that it owns runtime QA, review, and shipping, stop after step 5 and return phase evidence. Otherwise, after phases pass, run [`/review-code fix`](../review-code/SKILL.md) per the [caller contract](../review-code/references/caller-contract.md). Build is the caller: it owns the round budget. Record slice/top-level status: local validation, draft publication, and readiness.
7. If a design changes during implementation, update the affected `## Design` doc or spec and append a dated entry to the README `## Decision log`; keep the plan folder consistent with what shipped.
8. Summarize changes, validation, assumptions, and risks.

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
