---
name: speclist
description: Turns free-form reports into ordered, execution-ready implementation checklists. Use when analysis must become an actionable plan.
user-invocable: true
disable-model-invocation: false
---

# Speclist

## Core Contract

Convert one report into one executable implementation checklist and write it to markdown.
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
3. Build ordered checklist with verifiable actions.
4. Add `Open Questions`, `Risk Controls`, and optional `Out of Scope`.
5. Write markdown plan file (user path or sensible temp filename).

Stop and ask when scope is mixed, architecture decisions are unresolved, or blockers prevent sequencing.

## Safety Rules

- Never invent report facts; label uncertainty explicitly.
- Never hide unresolved blockers inside checklist items; surface them in "Open Questions".
- Never prescribe destructive steps (data deletion, force-push, hard reset) without explicit user approval.
- Never treat compliance/security requirements as optional if the report marks them mandatory.
- Do not claim execution or verification occurred; this skill produces a spec/checklist, not code changes by itself.

## Output Style

Provide objective, written plan path, ordered checklist, open questions, risk controls, and out-of-scope items.
