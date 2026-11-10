---
name: build
description: Implements scoped changes from a plan file, context, or inline plan in one pass, then validates against the acceptance items. Use when execution should start from existing requirements.
user-invocable: true
disable-model-invocation: false
---

# Build

## Core Contract

Implement one cohesive change in one pass, then validate it once against the plan's Acceptance items.

Define success criteria before editing. The builder runs cheap checks as it goes; independent validation and review happen once, after the change is complete. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Use the active environment's delegation mechanisms when a separate execution context improves discovery, implementation, or review. Keep small cohesive work inline. Run independent scopes concurrently only when writers are isolated, and let the environment choose its agents, models, and tools.

## Required Inputs

1. Source: a plan file, context, or inline plan. If absent, derive a minimal plan from intent.
   - Given a plan file: read its **Outcome**, **Acceptance**, **Decisions**, **Approach**, and **Risks and unknowns**. Follow the PR split rule in the `review-code` skill's `references/caller-contract.md`.
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour (BDD/TDD), not implementation details.
4. Required validation and the tooling/methods it depends on.
5. Constraints and delivery expectations (e.g. commit/PR).

## Workflow

1. Restate the objective and behavioural success criteria. For underspecified requests, run `scrutiny` Mode A's pre-build contract first. Only user-confirmed items become obligations; retain assumptions and unresolved decisions as evidence.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/git branch` or `/git worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it.
4. Implement from the plan's **Approach**, in whatever order suits the work. Do not split it into separately validated phases or reviews. Run the fast checks the change touches (build, unit tests) as you go. Do not edit or weaken the plan's acceptance tests or fixtures unless the plan allows it.
5. When the change is complete, have one distinct validator step execute the Acceptance checks and record evidence against each item. Then run `complexity` (default scope: this branch's changes) once on the code you wrote. Simplify a function in the Refactor band that you changed, then re-run the affected checks. Treat a Review-band function as a note. If Lizard is unavailable, record the gap and continue. Run `/git commit` only when shipping was requested.
6. When a caller such as `idea-to-pr` states that it owns runtime QA, review, and shipping, stop after step 5 and return the evidence. Otherwise, after the Acceptance checks pass, run one `/review-code fix` call on the whole change per the `review-code` skill's `references/caller-contract.md`. Build owns its review/fix invocation's round limit; a handoff to `/pr` passes packet/findings/evidence and `/pr` owns its own per-invocation limit. Record local validation, draft publication, and readiness status.
7. If implementation disproves or requires a design change, update the plan's **Decisions**, affected sections, and Acceptance evidence when repository policy tracks plans. Otherwise return the discrepancy in the handoff packet. Keep the plan consistent with what shipped.
8. Summarize changes, validation, assumptions, and risks.

## Safety Rules

- Never `/git commit` or `/pr` a change whose Acceptance items are unvalidated.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never rely on validation tooling without first confirming it is available and runnable.
- Never `/git commit`, push, or `/pr` unless the request includes shipping.
- Never treat ambiguous intent as approval for broad refactors.
- Never delegate work without a clear purpose, relevant context, required evidence, and expected result.
- Never revert or overwrite unrelated user changes, or use destructive git/file operations, without explicit approval.
- Never let the plan or handoff packet drift from reality when implementation diverges from it.

## Output Style

Report source/objective and success criteria/results, branch/worktree decision, validator commands/outcome evidence and limitations, Acceptance-item evidence, assignments, files changed, packet snapshot/verdict/findings and invocation-scoped round state, commits/publication or local-only status, and blockers/next actions. Distinguish source review, draft publication, human readiness, and approval; never claim independent review without evidence.
