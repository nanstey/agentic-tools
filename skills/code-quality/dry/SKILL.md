---
name: dry
description: Finds and ranks meaningful duplication and DRY violations in a chosen scope. Use when deciding what repeated logic should be consolidated.
---

# Dry

## Core Contract

Read-only DRY review: find meaningful duplication and propose concrete consolidation.
Do not edit files in this skill.
Prefer true shared concepts; avoid coupling independent logic just because it looks similar.
Do not intentionally skip valid issues because there are many; cover the full scoped surface.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Scope (confirm via `scope` unless already explicit).
2. File types to include/exclude.
3. Pass depth (high-signal default vs exhaustive).

## Workflow

1. Confirm scope and repository sharing conventions.
2. Gather candidates from diff or target directories.
3. Classify repetition: true duplication, near-duplication, or incidental similarity.
4. Propose smallest useful consolidation (reuse helper, extract helper, or create small focused file).
5. Score each finding on issue severity and improvement value (expected maintenance/testability/risk payoff).
6. Group findings into High/Medium/Low priority using the combined score.

## Safety Rules

- Never edit, create, move, stage, or commit files. This skill only reads and reports. Proposing a new file is a *proposal*, not an action.
- Do not recommend merging code that merely looks similar — false coupling is a regression. When in doubt, leave it separate and say why.
- Do not propose a sprawling catch-all `utils`/`helpers` file. New files must be narrow and named for a single concept.
- Do not over-index on tiny repetitions when larger consolidations exist, but do not suppress real issues due to volume; include all material findings and keep nits clearly low priority.
- Apply the rule of three as a guide, not a law: two occurrences can justify extraction when both must change together, and three near-copies can be fine if they're genuinely independent.

## Output Style

Report scope/exclusions, then findings grouped into `High`, `Medium`, and `Low` priority.
For each finding include `file:line` evidence, duplication type, issue severity, improvement value, and proposed consolidation.
Call out notable non-findings left separate and the highest-payoff next step.
