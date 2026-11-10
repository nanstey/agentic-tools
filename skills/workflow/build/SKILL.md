---
name: build
description: Implements scoped changes from a plan file, context, or inline plan through verifiable phases with acceptance-item validation. Use when execution should start from existing requirements.
user-invocable: true
disable-model-invocation: false
---

# Build

## Core Contract

Execute one cohesive change as a sequence of individually verifiable phases, each with focused edits and validation.

Define success criteria before editing and advance only when the current phase's criteria pass. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Use the active environment's delegation mechanisms when a separate execution context improves discovery, implementation, or review. Keep small cohesive work inline. Run independent scopes concurrently only when writers are isolated, and let the environment choose its agents, models, and tools.

## Required Inputs

1. Source: a plan file, context, or inline plan. If absent, derive a minimal plan from intent.
   - Given a plan file: read its **Outcome**, **Acceptance**, **Decisions**, **Approach**, and **Risks and unknowns**. Choose implementation phases from its **Approach** and **Acceptance**. Follow the PR split rule in the `review-code` skill's `references/caller-contract.md`.
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour (BDD/TDD), not implementation details.
4. Required validation and the tooling/methods it depends on.
5. Constraints and delivery expectations (e.g. commit/PR).

## Workflow

1. Restate the objective and behavioural success criteria. For underspecified requests, run `scrutiny` Mode A's pre-build contract first. Only user-confirmed items become obligations; retain assumptions and unresolved decisions as evidence.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/git branch` or `/git worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it.
4. Decompose the work into individually verifiable phases from the plan's **Approach** and **Acceptance**.
5. For each phase: implement focused edits, have a distinct validator step execute checks and observe the applicable Acceptance items, and record validation evidence against those items only after it passes. Run `/git commit` only when shipping was requested.
   After a phase passes validation, run `complexity` (default scope: this branch's changes) on the code you wrote. Simplify a function in the Refactor band that you changed, then re-validate. Treat a Review-band function as a note. If Lizard is unavailable, record the gap and continue.
6. When a caller such as `idea-to-pr` states that it owns runtime QA, review, and shipping, stop after step 5 and return phase evidence. Otherwise, after phases pass, run `/review-code fix` per the `review-code` skill's `references/caller-contract.md`. Build owns its review/fix invocation's round limit; a handoff to `/pr` passes packet/findings/evidence and `/pr` owns its own per-invocation limit. Record local validation, draft publication, and readiness status.
7. If implementation disproves or requires a design change, update the plan's **Decisions**, affected sections, and Acceptance evidence when repository policy tracks plans. Otherwise return the discrepancy in the handoff packet. Keep the plan consistent with what shipped.
8. Summarize changes, validation, assumptions, and risks.

## Safety Rules

- Never advance, `/git commit`, or `/pr` a phase whose success criteria are unvalidated.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never rely on validation tooling without first confirming it is available and runnable.
- Never `/git commit`, push, or `/pr` unless the request includes shipping; when it does, treat them as phase and completion steps.
- Never treat ambiguous intent as approval for broad refactors.
- Never delegate work without a clear purpose, relevant context, required evidence, and expected result.
- Never revert or overwrite unrelated user changes, or use destructive git/file operations, without explicit approval.
- Never let the plan or handoff packet drift from reality when implementation diverges from it.

## Output Style

Report source/objective and per-phase success criteria/results, branch/worktree decision, validator commands/outcome evidence and limitations, Acceptance-item evidence, assignments, files changed, packet snapshot/verdict/findings and invocation-scoped round state, commits/publication or local-only status, and blockers/next actions. Distinguish source review, draft publication, human readiness, and approval; never claim independent review without evidence.
