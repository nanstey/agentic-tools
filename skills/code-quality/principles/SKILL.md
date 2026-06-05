---
name: principles
description: Evaluate software decisions with a curated principles hierarchy by loading canonical principle knowledge, selecting the highest-impact checks, resolving principle conflicts with a foundation-first tie-break rule, and producing evidence-backed recommendations. Use when making architecture choices, writing non-trivial code, or reviewing changes for long-term maintainability.
user-invocable: true
disable-model-invocation: false
---

# Principles

## Core Contract

Use this skill to run a lightweight principles pass before and during design,
implementation, and code review, using the canonical hierarchy relative to this
skill directory:

- `../_knowledge/principles/index.json`
- `../_knowledge/principles/<category>/<principle-id>.md`

Default behavior is repeatable and evidence-based: frame the decision, select
the highest-impact principles, evaluate pass/fail against concrete context, and
resolve conflicts with a deterministic priority tie-break.

This skill is guidance, not dogma. Prefer pragmatic choices that fit constraints
without accumulating avoidable maintenance cost.

Keep `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. Current task type (`design`, `implement`, or `review`).
2. Scope under change (module, API surface, workflow, or subsystem).
3. Constraints (performance, timeline, compatibility, team conventions).
4. Whether the change is incremental or foundational.
5. Whether canonical-only mode should be used (default: yes).

## Workflow

### 1. Frame the decision

1. State what is being decided, changed, or reviewed.
2. Identify the riskiest failure mode if the design is wrong.
3. Note any likely principle conflicts (for example `yagni` vs `agile-practices`).

### 2. Load canonical principles hierarchy

1. Read `../_knowledge/principles/index.json`.
2. Build candidate principles from `principles[]`, using `aliases` only as lookups.
3. Select 3-5 principles with highest impact for the current decision.
4. For each selected principle, load its markdown page at
   `../_knowledge/principles/<category>/<principle-id>.md`.

Stop-and-ask gate: if the requested principle is not in canonical data, ask for
approval before introducing non-canonical principles or labels.

### 3. Evaluate selected principles

Use each selected page as: **What it means -> Apply when -> Good vs bad ->
Tradeoffs and conflicts**.

For each selected principle:

1. Record pass/fail with one sentence of evidence.
2. If failing intentionally, document reason and guardrail.
3. Propose the smallest viable remediation that does not break lower-priority
   commitments.

### 4. Resolve conflicts with priority tie-break

1. Detect conflicts between selected principles.
2. Compare `priority_level` from `index.json`.
3. Prefer the lower value (foundation-first) when principles conflict.
4. Keep a guardrail note for the deferred principle.
5. If conflict resolution changes scope, architecture, or delivery timing, stop
   and ask before proceeding.

### 5. Verify outcomes

1. Confirm readability and testability improved (or did not regress).
2. Confirm abstractions have immediate use, not speculation.
3. Confirm conflict decisions were explicit and defensible.
4. Confirm complexity matches present requirements and constraints.

## Implementation Notes

- Keep the checklist fast: usually 3-5 principles per decision.
- Use `aliases` for lookup only; report canonical `id` and `name`.
- Treat `priority_level` as a tie-break for conflicts, not as a reason to ignore
  relevant higher-level principles.
- During reviews, tie recommendations to concrete code evidence, not generic advice.
- Re-run this skill after major scope or architecture changes.

## Safety Rules

- Never apply principles mechanically when constraints require a pragmatic exception.
- Never add speculative abstractions solely to satisfy a principle.
- Never report "best practice" claims without concrete context.
- Never invent non-canonical principle IDs/labels without explicit user approval.
- Never force broad refactors without user approval when localized fixes are sufficient.

## Output Style

When finishing, report:

1. Task type and scope reviewed.
2. Principles applied (3-5 canonical IDs) and pass/fail evidence for each.
3. Conflict resolutions (if any): winner principle, deferred principle, and rationale.
4. Intentional violations with guardrails.
5. Concrete follow-up actions (if any), ordered by impact.
