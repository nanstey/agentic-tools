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

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as “build,” “implement,” “ship,” or “wire up” as checklist scope, not permission to execute.
2. Ingest report and restate objective.
3. Extract requirements, assumptions, risks, and constraints.
4. Track every uncertainty as an open question and resolve each before building the final checklist:
   - Verifiable from the report or codebase: investigate directly and record the finding.
   - Not verifiable (intent, priorities, trade-offs): expose the decision to the user via harness question tooling when available, plain questions otherwise.
   - Loop until no open questions remain.
5. Build ordered checklist with verifiable actions.
6. Add `Risk Controls` and optional `Out of Scope`.
7. Write markdown plan file (user path or sensible temp filename). Then present it for explicit user review and stop; do not begin implementation or invoke a follow-on skill.

Stop and ask whenever an uncertainty is not resolvable by investigation; do not finalize the checklist past it.

## Safety Rules

- Never treat an implementation imperative as permission to edit source, invoke a build workflow, or proceed past the review gate.
- Explicit approval of the checklist selects a later, separate planning or build phase; it never authorizes source edits within this skill.
- Never invent report facts; verify each or expose the decision to the user.
- Never hide unresolved blockers inside checklist items; resolve them with the user before finalizing.
- Never finalize the checklist while open questions remain; resolve them all first.
- Never prescribe destructive steps (data deletion, force-push, hard reset) without explicit user approval.
- Never treat compliance/security requirements as optional if the report marks them mandatory.
- Do not claim execution or verification occurred; this skill produces a spec/checklist, not code changes by itself.

## Output Style

Provide objective, written plan path, ordered checklist, risk controls, out-of-scope items, how each open question was resolved (verified or answered), and review status. Wait for explicit user approval before any follow-on work.
