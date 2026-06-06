---
name: principles
description: Applies a canonical software-principles checklist to design and code decisions. Use when making non-trivial architecture, implementation, or review choices.
user-invocable: true
disable-model-invocation: false
---

# Principles

## Core Contract

Run a lightweight, evidence-based principles pass for design/implementation/review decisions.
Use canonical local datasets: `principles/index.json` and per-principle markdown files.
Prefer pragmatic outcomes over dogmatic application.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Task type (`design`, `implement`, `review`).
2. Scope under change.
3. Constraints.
4. Likely principle conflicts.

## Workflow

1. Confirm scope (use `scope` unless already explicit).
2. Frame the decision and main failure risk.
3. Load `principles/index.json`, then select 3-5 high-impact principles.
4. Evaluate each selected principle with pass/fail evidence.
5. Resolve conflicts using `priority_level` tie-break and record guardrails.
6. Propose minimal remediations and explicit accepted exceptions.

## Safety Rules

- Never apply principles mechanically when constraints require a pragmatic exception.
- Never add speculative abstractions solely to satisfy a principle.
- Never report "best practice" claims without concrete context.
- Never invent non-canonical principle IDs/labels without explicit user approval.
- Never force broad refactors without user approval when localized fixes are sufficient.

## Output Style

Use five sections:
1. Review Frame (`Type`, `Scope`, `Why`).
2. Principle Outcomes (3-5 canonical IDs with verdict + evidence).
3. Priority Conflict Log (detected conflicts, tie-break, guardrail).
4. Accepted Exceptions (or `None identified`).
5. Action Queue (highest impact first).
