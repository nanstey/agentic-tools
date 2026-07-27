---
name: build
description: Implements scoped changes from context, plans, or speclists through verifiable phases with up-front success criteria and per-phase validation. Use when execution should start from existing requirements.
user-invocable: true
disable-model-invocation: false
---

# Build

## Core Contract

Execute one cohesive change using subagents as a sequence of individually verifiable phases, each with edits and validation.

Define success criteria before editing and advance only when the current phase's criteria pass.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Protect the context window of your main thread by delegating to subagents wherever possible. Run subagents in parallel where possible. Choose an appropriate model per task.

## Required Inputs

1. Source: a plan folder `README.md`, `context`, `plan`, or `speclist` (inline or filepath). If absent, derive a minimal plan from intent.
   - Given a plan-folder README: read it for the big picture, follow its `## Design` docs for context, and take the target slice's `specs/NN-*.md` as the phase checklist. Build one slice per PR unless told otherwise; stack dependent slices via `/gh-stack` or `/pr-restack`.
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour (BDD/TDD), not implementation details.
4. Required validation and the tooling/methods it depends on.
5. Constraints and delivery expectations (e.g. commit/PR).

If no actionable target or intent exists, stop and ask.

## Workflow

1. Classify input, restate objective, and define behavioural success criteria up front.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/branch` or `/worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it.
4. Decompose into individually verifiable phases.
5. For each phase: implement focused edits, and validate its success criteria, update speclist checkboxes only after validation, then run `/commit`.
6. When all phases pass, run `/pr`. In a plan folder, set the slice's `PR` and `Status` cells in the README `## Slices` table and update the top-level `Status`.
7. If a design changes during implementation, update the affected `## Design` doc or spec and append a dated entry to the README `## Decision log`; keep the plan folder consistent with what shipped.
8. Summarize changes, validation, assumptions, and risks.

Stop and ask when scope is ambiguous, architecture choices are unresolved, or validation is blocked by missing access/resources.

## Safety Rules

- Never advance, `/commit`, or `/pr` a phase whose success criteria are unvalidated.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never rely on validation tooling without first confirming it is available and runnable.
- Never `/commit`, push, or `/pr` unless the request includes shipping; when it does, treat them as phase and completion steps.
- Never treat ambiguous intent as approval for broad refactors.
- Never delegate to a subagent without a scoped task, chosen model, and return contract.
- Never revert or overwrite unrelated user changes, or use destructive git/file operations, without explicit approval.
- Never let a plan folder drift from reality: update its README index and design docs when implementation diverges from the plan.

## Output Style

Report source used, objective and success criteria with per-phase pass/fail, branch/worktree decision, validation tooling used (and any missing), subagent delegations (task + model), files changed, commits per phase and final PR status, plus assumptions, risks, and next steps.
