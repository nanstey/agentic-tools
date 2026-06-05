---
name: refactor
description: Orchestrate smell-to-plan flow by validating findings, delegating one smell at a time to `fresh-air` when needed, aggregating recommendations, and authoring a final implementation plan. Use when coordinating multi-smell refactor planning end-to-end.
user-invocable: true
disable-model-invocation: false
---

# Refactor

## Core Contract

Use this skill as an orchestrator, not a technique-ranking worker. It validates
incoming smell findings, fans out one smell at a time to `fresh-air`,
aggregates per-smell recommendations, and writes the final implementation plan.

Canonical smell IDs are validated from this skill's local dataset:

- `./smells/index.json`
- `./techniques/index.json`
- `./technique-map/smell-to-technique.json`

Treat `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. `sniff` findings or direct user-provided canonical smell entries with
   evidence locations.
2. Target code scope and constraints.
3. Desired output plan path (if provided).
4. Definition of done for plan quality (tests, rollout, risk checks).

## Workflow

### 1. Validate incoming findings

1. Confirm each finding has canonical smell ID and evidence.
2. Ensure smells exist in `./smells/index.json`.
3. If a technique is pre-specified, ensure it exists in `./techniques/index.json`.
4. Drop/flag malformed findings before orchestration.

Stop-and-ask gate: if findings are missing evidence or canonical mapping, pause
and request corrected `sniff` output.

### 2. Decide execution path (standard vs fast path)

Use the fast path when user-provided context is sufficiently specific:

- canonical smell IDs are present,
- evidence locations are present,
- constraints are present,
- and explicit technique recommendations are present.

If any required specificity is missing, use the standard path below.

### 3. Standard path: fan out to `fresh-air` per smell

1. Invoke `fresh-air` once per smell finding.
2. Pass only one smell and one evidence location per invocation.
3. Collect each response payload:
   - primary technique
   - optional fallback
   - concrete code-improvement suggestion
   - confidence and open clarification

Minimal safety check: if any smell receives no viable recommendation, mark it
as unresolved and surface it explicitly.

### 4. Fast path: skip workers when context is already specific

When user input already includes specific techniques and rationale-quality
context, skip `sniff` and/or `fresh-air` and carry those entries forward.

Validate before accepting each direct entry:

1. Canonical smell ID exists in `./smells/index.json`.
2. Evidence location is concrete.
3. Constraints are concrete enough to guide implementation.
4. At least one direct technique recommendation is present.
5. Every direct technique recommendation exists in `./techniques/index.json`.

Any entry that fails validation must be routed through the standard path.

### 5. Aggregate recommendation set

1. Merge per-smell outputs into one refactor recommendation report.
2. Group by scope and dependency where useful.
3. Use `./technique-map/smell-to-technique.json` relationships as a consistency
   check for cross-smell sequencing notes.
4. Highlight confidence and unresolved ambiguity.

### 6. Author final implementation plan

1. Convert the aggregated recommendation report into an ordered implementation
   checklist.
2. Include sequencing, risk controls, and validation steps.
3. Capture and report the final plan artifact path.

## Implementation Notes

- Keep orchestration deterministic and traceable from smell -> recommendation.
- Use `fresh-air` for technique selection, not direct technique ranking here.
- Use fast path only when user-provided context passes validation gates.
- Keep unresolved smells visible instead of silently dropping them.

## Safety Rules

- Never skip `fresh-air` fan-out unless fast-path validation passes completely.
- Never skip validation gates when using the fast path.
- Never synthesize recommendations that contradict validated direct input.
- Never emit a "complete" result if any smell lacks evidence or recommendation.
- Never hide open questions before final plan authoring.

## Output Style

When finishing, report:

1. Count of smells processed and unresolved.
2. Smell-to-technique summary (primary/fallback/confidence).
3. Execution path used (`standard`, `fast path`, or mixed).
4. Final generated plan artifact path.
