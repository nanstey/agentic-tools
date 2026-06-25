---
name: speclist
description: Turns free-form reports into ordered, execution-ready implementation checklists. Use when analysis must become an actionable plan.
user-invocable: true
disable-model-invocation: false
---

# Speclist

## Core Contract

Convert one report into one executable implementation checklist and write it to markdown.
Resolve every open question before finalizing: verify from the report/codebase, or expose the decision to the user and get an answer.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Source report/link.
2. Scope boundaries.
3. Constraints and definition of done.
4. Desired depth and output path.

If source is too vague to extract actions, stop and ask.

## Workflow

1. Ingest report and restate objective.
2. Extract requirements, assumptions, risks, and constraints.
3. Track every uncertainty as an open question and resolve each before building the final checklist:
   - Verifiable from the report or codebase: investigate directly and record the finding.
   - Not verifiable (intent, priorities, trade-offs): expose the decision to the user via harness question tooling when available, plain questions otherwise.
   - Loop until no open questions remain.
4. Build ordered checklist with verifiable actions.
5. Add `Risk Controls` and optional `Out of Scope`.
6. Write markdown plan file (user path or sensible temp filename).

Stop and ask whenever an uncertainty is not resolvable by investigation; do not finalize the checklist past it.

## Safety Rules

- Never invent report facts; verify each or expose the decision to the user.
- Never hide unresolved blockers inside checklist items; resolve them with the user before finalizing.
- Never finalize the checklist while open questions remain; resolve them all first.
- Never prescribe destructive steps (data deletion, force-push, hard reset) without explicit user approval.
- Never treat compliance/security requirements as optional if the report marks them mandatory.
- Do not claim execution or verification occurred; this skill produces a spec/checklist, not code changes by itself.

## Output Style

Provide objective, written plan path, ordered checklist, risk controls, out-of-scope items, and how each open question was resolved (verified or answered).
