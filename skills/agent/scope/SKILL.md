---
name: scope
description: Confirms and normalizes analysis scope, then returns clear scope assumptions. Use when work needs explicit boundaries before scanning files.
user-invocable: true
disable-model-invocation: false
---

# Scope

## Core Contract

Set analysis scope before scanning so work stays bounded and reproducible.
When specific lines, files, symbols, or names are provided, treat them as the explicit scope.
When scope is missing, prefer uncommitted changes first; if none exist, use current branch delta vs the resolved base. For PR work, take the base/head from `pr-info` (its authoritative comparison); otherwise resolve the base here.
If user already set scope, confirm and proceed.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. User goal.
2. Any explicit scope (including specific lines/files/names).
3. Base branch for branch-delta scope.
4. Speed vs breadth preference.

## Workflow

1. Check for explicit scope.
   - If user provides specific lines, files, symbols, or names, use that as scope directly.
2. If no explicit scope, check for uncommitted changes.
   - If present, set scope to uncommitted changes (staged + unstaged + untracked as relevant).
3. If no uncommitted changes, default to branch-delta scope against the resolved base.
4. For a PR, use the base/head from `pr-info`. Otherwise resolve a target branch/ref automatically (explicit target, then `main`/`develop`, then tracked upstream merge-base) and record its resolved SHA — a local branch name is a candidate, not proof of the base. Ask only if unresolved.
5. Restate final scope and exclusions.
6. If scope is still uncertain and could change conclusions, ask the user to clarify before proceeding.

## Safety Rules

- Never silently expand scope beyond what was confirmed.
- Never treat "quick look" as permission for a full-repo sweep.
- Never proceed with ambiguous scope when it can change conclusions; ask for clarification.

## Output Style

Report final scope, why it fits the goal, and any exclusions/assumptions.
