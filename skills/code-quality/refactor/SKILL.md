---
name: refactor
description: Orchestrate smell-to-plan flow by validating `sniff` findings, delegating one smell at a time to `fresh-air`, aggregating recommendations, and handing the merged result to `dev/speclist` for final plan-file authoring. Use when coordinating multi-smell refactor planning end-to-end.
user-invocable: true
disable-model-invocation: false
---

# Refactor

## Core Contract

Use this skill as an orchestrator, not a technique-ranking worker. It validates
incoming smell findings, fans out one smell at a time to `fresh-air`,
aggregates per-smell recommendations, and then hands the merged package to
`dev/speclist` to write the final plan file.

Canonical domain data lives under `skills/code-quality/_knowledge/`. This skill
does not maintain its own parallel hierarchy.

Treat `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. `sniff` findings (or equivalent canonical smell list) with evidence
   locations.
2. Target code scope and constraints.
3. Desired output plan path (if provided).
4. Definition of done for plan quality (tests, rollout, risk checks).

## Workflow

### 1. Validate incoming findings

1. Confirm each finding has canonical smell ID and evidence.
2. Ensure smells exist in `_knowledge/smells/index.json`.
3. Drop/flag malformed findings before orchestration.

Stop-and-ask gate: if findings are missing evidence or canonical mapping, pause
and request corrected `sniff` output.

### 2. Fan out to `fresh-air` per smell

1. Invoke `fresh-air` once per smell finding.
2. Pass only one smell and one evidence location per invocation.
3. Collect each response payload:
   - primary technique
   - optional fallback
   - concrete code-improvement suggestion
   - confidence and open clarification

Minimal safety check: if any smell receives no viable recommendation, mark it
as unresolved and surface it explicitly.

### 3. Aggregate recommendation set

1. Merge per-smell outputs into one refactor recommendation report.
2. Group by scope and dependency where useful.
3. Highlight confidence, unresolved ambiguity, and cross-smell sequencing notes.

### 4. Hand off plan authoring to `dev/speclist`

1. Pass the aggregated recommendation report to `dev/speclist`.
2. Request a concrete implementation-spec checklist plan file.
3. Capture and report the final plan artifact path.

## Implementation Notes

- Keep orchestration deterministic and traceable from smell -> recommendation.
- Use `fresh-air` for technique selection, not direct technique ranking here.
- Use `dev/speclist` for final markdown plan authoring.
- Keep unresolved smells visible instead of silently dropping them.

## Safety Rules

- Never skip `fresh-air` fan-out when multiple smells are present.
- Never synthesize technique recommendations directly when `fresh-air` output is
  available.
- Never emit a "complete" result if any smell lacks evidence or recommendation.
- Never hide open questions before handoff to `dev/speclist`.

## Output Style

When finishing, report:

1. Count of smells processed and unresolved.
2. Smell-to-technique summary (primary/fallback/confidence).
3. `dev/speclist` handoff status.
4. Final generated plan artifact path.
