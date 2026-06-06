---
name: scope
description: Confirms and normalizes analysis scope, then returns clear scope assumptions. Use when work needs explicit boundaries before scanning files.
user-invocable: true
disable-model-invocation: false
---

# Scope

## Core Contract

Set analysis scope before scanning so work stays bounded and reproducible.
Default to current branch delta vs base (`base...HEAD`) when scope is missing.
If user already set scope, confirm and proceed.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. User goal.
2. Any explicit scope.
3. Base branch for branch-delta scope.
4. Speed vs breadth preference.

## Workflow

1. Check for explicit scope; confirm and proceed.
2. If missing, default to branch-delta scope (`base...HEAD`) without extra questions.
3. Resolve base branch automatically (`main`, then `develop`, then tracked upstream merge-base); ask only if unresolved.
4. For branch scope, review `base...HEAD`; include working-tree deltas when present or requested.
5. Restate final scope and exclusions.
6. If module boundaries are unclear, ask once; if still unclear, keep branch-delta scope and state the assumption.

## Safety Rules

- Never silently expand scope beyond what was confirmed.
- Never treat "quick look" as permission for a full-repo sweep.
- Never proceed with ambiguous scope when it can change conclusions.

## Output Style

Report final scope, why it fits the goal, and any exclusions/assumptions.
