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

Use the active environment's delegation mechanisms when a separate execution context helps. Keep small cohesive work inline. Run independent scopes concurrently only when writers are isolated. When the caller passes an execution design, follow it. Build does not design the flow, run review, or publish; it returns evidence to its caller.

## Required Inputs

1. Source: a plan file, context, or inline plan. If absent, derive a minimal plan from intent.
   - Given a plan file: read its **Outcome**, **Acceptance**, **Decisions**, **Approach**, and **Risks and unknowns**.
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour, not implementation details.
4. Required validation and the tooling it depends on.
5. Optional: an execution design from the caller, and whether to commit.

## Workflow

1. Restate the objective and behavioural success criteria. If the request is underspecified and no plan exists, return the open questions instead of guessing.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/git branch` or `/git worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it. Before editing, run each new-behaviour Acceptance check once and record that it fails, as baseline evidence.
4. Implement from the plan's **Approach**, in whatever order suits the work. Do not split it into separately validated phases. When a design was passed, dispatch its independent streams in parallel as subagents, each with its slice of the plan and the Acceptance items it affects, with one owner for integration and cross-stream contracts. Without a design, split into parallel streams only when parts are clearly independent and writers can be isolated; otherwise work inline. Run the fast checks the change touches as you go. Do not edit or weaken the plan's acceptance tests or fixtures unless the plan allows it.
5. When the change is complete, have one distinct validator step execute the Acceptance checks, rerun each new-behaviour check, and record evidence against each item. Then run `complexity` once in report-only mode on the code you wrote and note any Refactor-band function in the result; do not edit after validation. If Lizard is unavailable, record the gap and continue. Run `/git commit` only when the caller requested it.
6. If implementation disproves or requires a design change, update the plan's **Decisions**, affected sections, and Acceptance evidence when repository policy tracks plans. Otherwise return the discrepancy in the result. Keep the plan consistent with what shipped.
7. Return changes, validation evidence per Acceptance item, assumptions, and risks. Name code review as an optional next step; do not run it.

## Safety Rules

- Never commit a change whose Acceptance items are unvalidated.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never rely on validation tooling without first confirming it is available and runnable.
- Never commit or push unless the caller requested it. Never open a PR.
- Never treat ambiguous intent as approval for broad refactors.
- Never delegate work without a clear purpose, relevant context, required evidence, and expected result.
- Never revert or overwrite unrelated user changes, or use destructive git/file operations, without explicit approval.
- Never let the plan drift from reality when implementation diverges from it.

## Output Style

Report source/objective, branch/worktree decision, validator commands and per-Acceptance-item evidence with limitations, files changed, assignments, commit status, and blockers/next actions. Never claim validation ran when it did not.
