---
name: fresh-air
description: Recommends best-fit refactoring techniques for canonical smell findings with confidence. Use when smell findings need scoped refactoring direction.
user-invocable: true
disable-model-invocation: false
---

# Fresh Air

## Core Contract

Recommend best-fit refactoring techniques for smell findings.
Return one primary and optional fallback per smell for downstream planning.
Do not author final plan files.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Smell IDs.
2. Evidence location per smell.
3. Constraints and hard boundaries.

## Workflow

1. Validate each smell entry (`smell_id`, `evidence_location`, constraints).
2. Load canonical mappings (`smells`, `technique-map`, `techniques` datasets).
3. Rank techniques by evidence fit, constraints, risk, and reversibility.
4. Return per-smell recommendation block:
   - primary technique + rationale,
   - optional fallback + trigger,
   - concrete improvement suggestion,
   - confidence.

Stop and ask when evidence is missing or no mapped technique exists.

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

Report shared constraints, compact per-smell recommendations, confidence per smell, and one optional clarification question when needed.
