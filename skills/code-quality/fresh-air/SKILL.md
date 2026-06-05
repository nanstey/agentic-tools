---
name: fresh-air
description: Analyze one or more canonical smell findings and recommend best-fit refactoring techniques from local mapping and technique detail datasets, including compact per-smell suggestions, optional fallbacks, and confidence. Use when smell findings need fast, scoped refactoring decisions before broader planning.
user-invocable: true
disable-model-invocation: false
---

# Fresh Air

## Core Contract

Use this skill as a smell-to-technique recommendation worker. It takes one or
more smell findings (usually from `sniff`), maps each smell to candidate
techniques, then performs deeper technique-level reasoning before recommending a
primary and optional fallback choice per smell.

`fresh-air` does not write final plan files. It recommends one primary
technique per smell and returns a compact structured handoff payload for
aggregation by `refactor` (or direct use).

Treat `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. One or more smell findings with canonical smell IDs.
2. One evidence location per smell (file/symbol/snippet reference).
3. Shared scope constraints (risk tolerance, compatibility limits, time budget).
4. Any hard boundaries (for example, "no API changes").

Stop-and-ask gate: if any smell lacks concrete evidence location, pause and
request only the missing evidence fields (do not reject the whole batch).

## Workflow

### 1. Validate smell batch payload

1. Normalize input into smell instances: `{smell_id, evidence_location}`.
2. Confirm each smell ID exists in `./smells/index.json`.
3. Confirm each smell has one evidence location.
4. Confirm constraints are explicit enough for ranking.

### 2. Load canonical candidates

1. Read shared datasets once per invocation:
   - `./smells/index.json`
   - `./technique-map/smell-to-technique.json`
2. For each smell, pull candidate technique IDs from the smell's
   `related_refactorings`.
3. Hydrate candidate metadata from:
   - `./techniques/index.json`
4. For top candidates per smell, load detailed technique cards from:
   - `./techniques/<category>/<technique-id>.md`
5. Use map edge types (`helps_refactoring`, `similar_refactoring`) as ranking
   signals.

Stop-and-ask gate: if a smell has no mapped techniques, ask whether to proceed
with nearest related techniques from smell metadata for that smell only.

### 3. Rank and select per smell

Score candidates by:

1. Fit to the specific evidence location.
2. Constraint compatibility.
3. Lowest safe change surface first.
4. Reversibility and validation burden.

Return one primary and at most one fallback technique.

### 4. Produce compact batch recommendation

Return:

1. A compact block per smell:
   - Smell ID + evidence location
   - Primary technique + short rationale
   - Optional fallback + when to use
   - One specific code-improvement suggestion
   - Confidence (`high`, `medium`, `low`) + uncertainty note only if needed
2. One shared assumptions/constraints line for the entire batch.
3. One targeted clarification question only when unresolved ambiguity would
   materially change recommendation quality.

## Implementation Notes

- Process each smell independently, but deduplicate repeated rationale where
  possible.
- Prefer deterministic dataset matches over free-form guesses.
- Highlight smallest safe first step for implementation.
- Use technique markdown details to ground tradeoffs and recommendation quality.
- Hand off to `refactor` for aggregation and final implementation-plan authoring.
- Keep output compact and chain-friendly:
  - Target 4-6 lines per smell.
  - Avoid repeating full preambles per smell.
  - Put shared constraints once at the top.

## Safety Rules

- Never drop smells silently; if capacity is exceeded, process in explicit
  chunks and report remaining count.
- Never recommend techniques without canonical mapping evidence unless user
  explicitly approves a fallback strategy.
- Never skip loading technique detail files for top candidates when they exist.
- If a required technique detail file is missing, state reduced confidence and
  ask whether to proceed with metadata-only ranking.
- Never hide low confidence; call it out and ask a targeted clarifying question.
- Never produce architecture-wide recommendations when a local technique is
  sufficient.

## Output Style

When finishing, report:

1. Shared assumptions/constraints once.
2. Compact per-smell recommendations in stable order.
3. Confidence per smell and one optional clarification question at end.
