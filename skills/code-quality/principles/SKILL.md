---
name: principles
description: Runs a prioritized principles review for plans and source artifacts using evidence-based pass/warn/fail outcomes.
user-invocable: true
disable-model-invocation: false
---

# Principles

## Core Contract

Run an exhaustive, evidence-based principles review.
Use `principles/index.json` and per-principle markdown files.
Prefer practical outcomes over rigid rule-following.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Review target type (`plan` or `code`).
2. Scope of source material (function, file, change set, PR/branch, domain, or codebase).
3. Constraints (delivery, reliability, performance, compatibility, team/process).
4. Primary decision/risk to evaluate and likely principle conflicts.
5. Evidence available (diff, tests, benchmarks, design notes, incident context, or code excerpts).

## Workflow

1. Call `scope` directly at the start of every review and use its resolved scope.
2. Define review objective: what should succeed, and what failure mode matters most.
3. Load `principles/index.json`; use `principles[]` order as hierarchy.
   - `priority_level` must match that order.
4. Evaluate every principle in hierarchy order.
   - Check foundational principles before advanced ones.
   - Do not stop early: always assess the full `principles[]` list.
   - If a higher-priority principle fails, make lower-priority recommendations conditional.
5. For each principle, classify outcome (`pass`, `warning`, `fail`) with direct evidence.
6. Resolve conflicts by preserving higher-priority intent and recording exception guardrails.
7. Propose minimal remediations and explicit exceptions for every `warning` or `fail`.

## Safety Rules

- Never apply principles mechanically when constraints require exceptions.
- Never add speculative abstractions solely to satisfy a principle.
- Never claim "best practice" without concrete context.
- Never invent out-of-list principle IDs or labels without explicit user approval.
- Never force broad refactors without user approval if local fixes are enough.
- Never mark a principle as pass/fail without citing concrete evidence from the reviewed artifact.

## Output Style

Use three sections in this exact order:
1. Scope
   - Clearly identify what was evaluated.
   - Include target boundary such as: function, file(s), module/package, change set/diff, PR/branch, or entire codebase.
   - Keep this section concise and specific.
2. Report
   - Include every principle in `principles[]` hierarchy order (highest importance first).
   - Each list item must contain only: status emoji + principle name.
   - Allowed format: `✅ <principle name>`, `⚠️ <principle name>`, or `❌ <principle name>`.
   - Do not include IDs, rationale, evidence, or extra text in this section.
3. Details
   - Include only principles with `warning` or `fail` outcomes.
   - Order items by outcome severity first (`fail` before `warning`), then by hierarchy importance. Title status emoji + name.
   - If all principles pass, include `Details` with `No warnings or failures.`
   - Give each principle its own subsection using this exact structure:

   ## <status emoji> <principle name>

   ### Finding
   Summary of findings

   ### Problem
   Concrete evidence with specific files, functions/symbols, and line references when available.

   ### Solution
   implementation-ready changes. Be specific about what to add, remove, move, or rename; include concrete file paths and recommended function/interface/module updates.
   
