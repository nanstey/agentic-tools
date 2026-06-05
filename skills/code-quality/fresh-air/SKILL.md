---
name: fresh-air
description: Analyze one canonical smell finding at a time and recommend the best-fit refactoring technique from shared code-quality knowledge, including a concrete code-improvement suggestion, fallback option, and confidence. Use when a single smell needs a scoped refactoring decision before broader planning.
user-invocable: true
disable-model-invocation: false
---

# Fresh Air

## Core Contract

Use this skill as a single-smell worker. It takes one smell finding (usually
from `sniff`), then maps that smell to technique candidates from the canonical
knowledge layer under `skills/code-quality/_knowledge/`.

`fresh-air` does not write final plan files. It recommends one primary
technique for one smell and returns a structured handoff payload for
aggregation by `refactor`.

Treat `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. Exactly one smell finding with canonical smell ID.
2. Exactly one evidence location for that smell (file/symbol/snippet reference).
3. Scope constraints (risk tolerance, compatibility limits, time budget).
4. Any hard boundaries (for example, "no API changes").

Stop-and-ask gate: if input includes multiple smells or no concrete evidence
location, pause and request a single-smell payload.

## Workflow

### 1. Validate single-smell payload

1. Confirm the smell ID exists in `_knowledge/smells/index.json`.
2. Confirm one evidence location is present.
3. Confirm constraints are explicit enough for ranking.

### 2. Load canonical candidates

1. Read `skills/code-quality/_knowledge/maps/smell-to-technique.json`.
2. Pull candidate technique IDs for the smell.
3. Hydrate candidate details from:
   - `skills/code-quality/_knowledge/refactor-techniques/index.json`
   - `skills/code-quality/_knowledge/refactor-techniques/techniques/<category>/<technique-id>.md`

Stop-and-ask gate: if the smell has no mapped techniques, ask the user whether
to proceed with nearest related techniques from smell metadata.

### 3. Rank and select

Score candidates by:

1. Fit to the specific evidence location.
2. Constraint compatibility.
3. Lowest safe change surface first.
4. Reversibility and validation burden.

Return one primary and at most one fallback technique.

### 4. Produce single-smell recommendation

Return:

1. Primary technique and rationale.
2. Optional fallback technique and when to use it.
3. One specific code-improvement suggestion tied to the evidence.
4. Confidence (`high`, `medium`, `low`) with uncertainty notes.
5. Clarification question when ambiguity remains.

## Implementation Notes

- Keep output narrowly scoped to one smell instance.
- Prefer deterministic dataset matches over free-form guesses.
- Highlight smallest safe first step for implementation.
- Hand off to `refactor` for aggregation and to `dev/speclist` for final plan
  artifact authoring.

## Safety Rules

- Never process multiple smell findings in one invocation.
- Never recommend techniques without canonical mapping evidence unless user
  explicitly approves a fallback strategy.
- Never hide low confidence; call it out and ask a targeted clarifying question.
- Never produce architecture-wide recommendations when a local technique is
  sufficient.

## Output Style

When finishing, report:

1. Smell ID and evidence location handled.
2. Primary technique, optional fallback, and rationale.
3. Concrete code-improvement suggestion.
4. Confidence and any clarification prompt.
