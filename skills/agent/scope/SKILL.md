---
name: scope
description: Confirms and normalizes analysis scope, then returns clear scope assumptions. Use when work needs explicit boundaries before scanning files.
user-invocable: true
disable-model-invocation: false
---

# Scope

## Core Contract

Set analysis scope before scanning so work stays bounded and reproducible.
Default to current branch when scope is missing.
If user already set scope, confirm and proceed.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. User goal.
2. Any explicit scope.
3. Base branch for branch-delta scope.
4. Speed vs breadth preference.

## Workflow

1. Check for explicit scope; confirm and proceed.
2. If missing, default to current branch without extra questions.
3. For branch scope, review `base...HEAD`; include working-tree deltas when present or requested.
4. Restate final scope and exclusions.
5. If module boundaries are unclear, ask once; if still unclear, default to current branch and state the assumption.

## Safety Rules

- Never silently expand scope beyond what was confirmed.
- Never treat "quick look" as permission for a full-repo sweep.
- Never proceed with ambiguous scope when it can change conclusions.

## Output Style

Report final scope, why it fits the goal, and any exclusions/assumptions.
