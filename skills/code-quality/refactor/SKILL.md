---
name: refactor
description: Orchestrates smell-to-plan flow by validating findings and assembling a final plan. Use when coordinating multi-smell refactor planning.
user-invocable: true
disable-model-invocation: false
---

# Refactor

## Core Contract

Orchestrate smell findings into an implementation plan.
Validate findings, call `fresh-air` when needed, aggregate recommendations, then author final plan.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Smell findings with evidence.
2. Scope and constraints.
3. Desired plan path (if any).
4. Plan quality criteria.

## Workflow

1. Validate findings and canonical IDs.
2. Choose path:
   - standard: call `fresh-air` per smell,
   - fast path: accept direct technique input only if fully validated.
3. Aggregate per-smell recommendations and confidence.
4. Produce ordered implementation checklist with risks and validation steps.
5. Report unresolved smells explicitly.

## Safety Rules

- Never skip `fresh-air` fan-out unless fast-path validation passes completely.
- Never skip validation gates when using the fast path.
- Never synthesize recommendations that contradict validated direct input.
- Never emit a "complete" result if any smell lacks evidence or recommendation.
- Never hide open questions before final plan authoring.

## Output Style

Report processed/unresolved smell counts, smell-to-technique summary, execution path (`standard`/`fast path`/mixed), and final plan artifact path.
