---
name: sniff
description: Run a structured code-smell review that maps findings to canonical smell categories and smell files from a local hierarchy, then report evidence-backed risks with related refactorings for each detected smell. Use when reviewing maintainability risks, hidden design debt, or refactor priorities.
user-invocable: true
disable-model-invocation: false
---

# Sniff

## Core Contract

Use this skill to run a code-smell-first maintainability review. It is designed
for review work, not for writing new feature code.

Default behavior is lightweight but evidence-based: identify relevant smell
categories, map findings to canonical smell entries, and report a ranked action
checklist with practical remediation direction.

The smell taxonomy is maintained in the shared code-quality knowledge layer:

- `../_knowledge/smells/index.json` for lookup.
- `../_knowledge/smells/<category>/<smell-id>.md` for
  per-smell details.

Treat `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. Review scope (`diff`, `directory`, or `subsystem`).
2. Language and framework context for the code under review.
3. Target strictness (`quick high-signal` vs `deeper sweep`).
4. Whether to use only canonical smells from
   `../_knowledge/smells/index.json` (default).

## Workflow

### 1. Frame the review

1. Confirm what is being reviewed and why (PR gate, cleanup pass, or diagnosis).
2. Identify likely pain type: readability, change-cost, coupling, or bloat.
3. Select 2-4 smell categories to prioritize first.

### 2. Load smell hierarchy

1. Read `../_knowledge/smells/index.json`.
2. Resolve candidate smell names to canonical smell IDs.
3. For each selected smell, read
   `../_knowledge/smells/<category>/<smell-id>.md`.

Stop-and-ask gate: if a candidate finding does not map cleanly to a canonical
smell ID, ask before introducing a custom label.

### 3. Run smell-backed findings

For each selected smell, use file content as:

1. Signs/symptoms anchor.
2. Why this problem appears.
3. Treatment direction and related refactorings.
4. Payoff and performance notes (when relevant).

Always tie findings to concrete code evidence.
Always attach at least one related refactoring recommendation per detected smell.

### 4. Decide severity and actions

1. Mark each finding as `high`, `medium`, or `low` maintainability risk.
2. For each `high` finding, propose one concrete refactor direction.
3. Record one intentional non-finding where similar code is acceptable.

Stop-and-ask gate: if remediation requires architecture or scope changes beyond
the requested review, pause and ask before proposing implementation work.

### 5. Verify and report

1. Ensure every finding maps to a canonical smell ID.
2. Ensure evidence is concrete and tied to reviewed code locations.
3. Keep final report short and prioritized.

## Implementation Notes

- Prefer high-confidence smell labels over broad low-confidence sweeps.
- If several smells apply, choose a primary smell and list secondary smells.
- Avoid language-specific dogma; map smell intent to local idioms.
- Use related refactorings from smell files as recommendations, not mandates.
- If a smell file has no related refactorings, map from smell treatment text and
  state confidence.

## Safety Rules

- Never label something a smell without evidence in the reviewed code.
- Never demand broad refactors when a localized fix addresses the risk.
- Never force category coverage; report only smells that actually appear.
- Never invent canonical smell IDs outside
  `../_knowledge/smells/index.json` without user approval.

## Output Style

When finishing, report:

1. Scope reviewed and categories/smells evaluated.
2. Findings grouped by category and smell, each with:
   - simple explanation,
   - apply-when rationale,
   - treatment direction,
   - related refactorings (required),
   - short reference.
3. Severity-ranked top actions and one intentional non-finding.
