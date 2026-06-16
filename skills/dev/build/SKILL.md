---
name: build
description: Implements scoped changes from context, plans, or speclists through verifiable phases with up-front success criteria and per-phase validation. Use when execution should start from existing requirements.
user-invocable: true
disable-model-invocation: false
---

# Build

## Core Contract

Execute one cohesive change as a sequence of individually verifiable phases, each with edits and validation.
Define success criteria before editing and advance only when the current phase's criteria pass.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Source: `context`, `plan`, or `speclist` (inline or filepath). If absent, derive a minimal plan from intent.
2. Outcome and boundaries.
3. Success criteria stated as observable behaviour (BDD/TDD), not implementation details.
4. Required validation and the tooling/methods it depends on.
5. Constraints and delivery expectations (e.g. commit/PR).

If no actionable target or intent exists, stop and ask.

## Workflow

1. Classify input, restate objective, and define behavioural success criteria up front.
2. Assess branch fitness: if the current branch is unsuitable or the tree is dirty, run `/branch` or `/worktree` before editing.
3. Confirm validation tooling is available and runnable; acquire or flag missing tooling before relying on it.
4. Decompose into individually verifiable phases; plan delegation of decomposable or parallel work to subagents, choosing a model per subtask and protecting main-thread context.
5. For each phase: implement in small focused edits, validate its success criteria, update speclist checkboxes only after validation, then run `/commit`.
6. When all phases pass, run `/pr`.
7. Summarize changes, validation, assumptions, and risks.

Stop and ask when scope is ambiguous, architecture choices are unresolved, or validation is blocked by missing access/resources.

## Safety Rules

- Never advance, `/commit`, or `/pr` a phase whose success criteria are unvalidated.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never rely on validation tooling without first confirming it is available and runnable.
- Never `/commit`, push, or `/pr` unless the request includes shipping; when it does, treat them as phase and completion steps.
- Never treat ambiguous intent as approval for broad refactors.
- Never delegate to a subagent without a scoped task, chosen model, and return contract.
- Never revert or overwrite unrelated user changes, or use destructive git/file operations, without explicit approval.

## Output Style

Report source used, objective and success criteria with per-phase pass/fail, branch/worktree decision, validation tooling used (and any missing), subagent delegations (task + model), files changed, commits per phase and final PR status, plus assumptions, risks, and next steps.
