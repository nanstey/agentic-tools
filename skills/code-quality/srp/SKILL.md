---
name: srp
description: Evaluates Single Responsibility Principle violations in a chosen scope and recommends cohesive boundaries. Use when reviewing mixed responsibilities in files, classes, or modules.
user-invocable: true
disable-model-invocation: false
---

# SRP

## Core Contract

Read-only SRP review: find mixed responsibilities and propose cohesive boundaries.
Do not edit files in this skill.
Prefer clear ownership and cohesion over cosmetic splitting.
Do not intentionally skip valid issues because there are many; cover the full scoped surface.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Scope (target files, directories, or diff).
2. Units to analyze (file/module/class/function level).
3. Pass depth (high-signal default vs exhaustive).

## Workflow

1. Confirm scope, exclusions, and ownership context.
2. Gather candidate units with frequent edits, broad APIs, or mixed concerns.
3. Classify responsibilities (domain rules, orchestration, transport, persistence, formatting, framework glue).
4. Evaluate "reason to change" pressure using stakeholder ownership and change history signals.
5. Propose smallest cohesive boundary change (split unit, extract adapter, isolate orchestration, or tighten API surface).
6. Score each finding on issue severity and improvement value (expected maintainability/testability/risk payoff).
7. Group findings into High/Medium/Low priority using the combined score.

## Safety Rules

- Never edit, create, move, stage, or commit files. This skill only reads and reports.
- Do not fragment cohesive logic into tiny pieces just to satisfy SRP wording; preserve readability and local reasoning.
- Do not recommend extraction when responsibilities are tightly coupled and changed together for the same business reason.
- Do not confuse layering with SRP: a unit can be small and still violate SRP if it serves unrelated stakeholders.
- Prefer stable seams (domain vs adapters, policy vs IO) over speculative abstractions.
- Do not hide material SRP violations due to volume; include all material findings and mark lower-impact items as Low priority.

## Output Style

Report scope/exclusions, then findings grouped into `High`, `Medium`, and `Low` priority.
For each finding include `file:line` evidence, mixed responsibilities, severity, improvement value, ownership/change-pressure rationale, and proposed boundary change.
End with the highest-payoff next boundary improvement.
