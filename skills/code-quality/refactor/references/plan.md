# Refactor planning method

## Core Contract

Orchestrate smell findings into an implementation plan.
Validate findings, call `fresh-air` when needed, aggregate recommendations, then author the final plan.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

This route is planning only. Write only the requested plan artifact, not source changes.
Implementation imperatives define planning scope, not execution authority.
Do not invoke follow-on implementation. Stop for explicit user review after the artifact.

## Required Inputs

1. Smell findings with evidence.
2. Scope and constraints.
3. Desired plan path (if any).
4. Plan quality criteria.

## Workflow

1. Validate findings and reference IDs against the preserved [reference datasets and fast-path schema](../REFERENCE.md).
2. Choose path:
   - standard: use the [fresh-air method](../../fresh-air/SKILL.md) per smell,
   - fast path: accept direct technique input only if fully validated.
3. Aggregate per-smell recommendations and confidence.
4. Produce an ordered implementation checklist with risks and validation steps.
5. Report unresolved smells explicitly.

Per-smell recommendations are required within this selected route. They do not authorize unrelated specialist work or automatic concurrent fanout.
Keep all specialist evidence, constraints, primary/fallback recommendations, rationale, and confidence in the aggregated report.

## Safety Rules

- Never skip per-smell `fresh-air` recommendations unless fast-path validation passes completely.
- Never skip validation gates when using the fast path.
- Never synthesize recommendations that contradict validated direct input.
- Never emit a "complete" result if any smell lacks evidence or recommendation.
- Never hide open questions before final plan authoring.
- Never change source or execute the plan from this planning-only route.

## Output Style

Report processed/unresolved smell counts, smell-to-technique summary, execution path (`standard`/`fast path`/mixed), and final plan artifact path.
