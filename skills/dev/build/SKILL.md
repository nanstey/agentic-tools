---
name: build
description: Implements scoped changes from context, plans, or speclists and validates outcomes. Use when execution should start from existing requirements.
user-invocable: true
disable-model-invocation: false
---

# Build

## Core Contract

Execute one cohesive change from provided context/plan/speclist, including edits and validation.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Source: `context`, `plan`, or `speclist` (inline or filepath).
2. Outcome and boundaries.
3. Required validation.
4. Constraints and delivery expectations.

If no actionable target exists, stop and ask.

## Workflow

1. Classify input and restate objective.
2. Build a minimal task sequence.
3. Implement in small focused edits.
4. Validate with the narrowest useful checks.
5. Update speclist checkboxes only after validation.
6. Summarize changes, validation, assumptions, and risks.

Stop and ask when scope is ambiguous, architecture choices are unresolved, or validation is blocked by missing access/resources.

## Safety Rules

- Never treat ambiguous intent as approval for broad refactors.
- Never claim validation ran when it did not; distinguish executed checks from proposed checks.
- Never commit, push, or open a PR unless the user asked.
- Never revert or overwrite unrelated user changes without explicit instruction.
- Never use destructive git/file operations without explicit approval.

## Output Style

Report source used, objective, files changed, validation outcomes/blockers, assumptions, and next steps.
