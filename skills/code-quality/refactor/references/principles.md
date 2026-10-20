# Principles

## Core Contract

Run an exhaustive, evidence-based principles review under the caller's [execution context](../REFERENCE.md#execution-context), which controls mode, authority, scope, evidence reuse, and validation. Follow `CLAUDE.md` / `AGENTS.md`; prefer practical outcomes over rigid rules.

Load [the principles index](principles/index.json), then only the cards needed for each ordered check. Dataset paths are relative to this file; index paths resolve from its directory. Cards are `principles/<group>/<NN>-<principle-id>.md`, ranked 01–17 in `1-high` (1–4), `2-med` (5–13), and `3-low` (14–17). The [quality summary](#quality-summary) is unranked and reuses this review; it adds no pass.

## Required Inputs

1. Review target type (`plan` or `code`).
2. Scope of source material (function, file, change set, PR/branch, domain, or codebase).
3. Constraints (delivery, reliability, performance, compatibility, team/process).
4. Primary decision/risk to evaluate and likely principle conflicts.
5. Evidence available (diff, tests, benchmarks, design notes, incident context, or code excerpts).

## Workflow

1. Use the caller-resolved scope; if unresolved, resolve it from repository guidance and evidence before checks. Do not repeat scope selection or narrow full scope to a diff.
2. Define review objective: what should succeed, and what failure mode matters most.
3. Load `principles/index.json`; use `principles[]` order as hierarchy.
   - Follow the approved unique ranks 1–17. Index order, group membership, filename prefix, and card priority must agree.
4. Evaluate every principle in hierarchy order. Apply the [shared finding reuse rule](../REFERENCE.md#finding-reuse).
   Use the method mapping below for applicable DRY/SRP checks. Reuse matching findings before inspecting uncovered material.
   - Check foundational principles before advanced ones.
   - Do not stop early: always assess the full `principles[]` list.
   - Keep all material findings. Make remedies conditional only when an evidenced design conflict requires it.
5. For each examined principle, classify outcome (`pass`, `warning`, `fail`) with direct evidence. Mark unexamined or unsupported checks as `not assessed` coverage gaps, never passes; all 17 entries remain visible.
6. Resolve conflicts with the [default precedence rule](../REFERENCE.md#default-precedence). Lower numbers win design trade-offs by default, not correctness, security, compatibility, or product obligations.
   Record concrete evidence and guardrails for exceptions. Never dismiss a request from a higher-numbered principle because a lower-numbered concern exists.
7. Propose minimal remediations and explicit exceptions for every `warning` or `fail`. State each as a claim backed by its reason and concrete evidence from the artifact (`prep`).

## Method mapping

| Check trigger | Procedure owner      |
| ------------ | -------------------- |
| `dry`        | [DRY procedure](extract.md#dry-procedure) |
| `srp`        | [SRP procedure](extract.md#srp-procedure) |

The `srp` trigger is a declared alias of `single-responsibility` in the index.
Resolve check triggers through index IDs and aliases. Use the resolved index IDs in findings and principle labels.
Use these procedures inside the resolved review scope, not as separate broad reviews.
For a plan target, assess only the supplied artifact and mark missing source evidence as a gap.
Keep the full 17-principle hierarchy, evidence requirements, and bounded conflict-resolution rules.
Definition cards provide contextual guidance, not duplicate execution procedures.

## Safety Rules

- Never apply principles mechanically when constraints require exceptions.
- Never add speculative abstractions solely to satisfy a principle.
- Never claim "best practice" without concrete context.
- Never invent out-of-list principle IDs or labels without explicit user approval.
- Never force broad refactors if local fixes suffice. Apply only supported fixes within caller authority; preserve intentional exceptions.
- Never mark a principle as pass/fail without citing concrete evidence from the reviewed artifact.

## Output Style

Status emoji mapping:
- `pass` -> `✅`
- `warning` -> `⚠️`
- `fail` -> `❌`
- `not assessed` -> `❔` (coverage gap, not a principle judgment)
- Never use alternate fail symbols (`✖`, `✗`, `❎`, `🚫`, or text like `FAIL`) in `Report` or `Details` headings.

Use three sections in this exact order:
1. Scope
   - Clearly identify what was evaluated.
   - Include target boundary such as: function, file(s), module/package, change set/diff, PR/branch, or entire codebase.
   - Keep this section concise and specific.
   - Add one short unranked [quality summary](#quality-summary) from the completed review and stable finding IDs. Do not add another status or finding.
2. Report
   - Include every principle in `principles[]` hierarchy order (highest importance first).
   - Each list item must contain only: status emoji + principle name using the mapping above.
   - Allowed format: `✅ <principle name>`, `⚠️ <principle name>`, `❌ <principle name>`, or `❔ <principle name>` for unassessed coverage.
   - Do not include IDs, rationale, evidence, or extra text in this section.
3. Details
   - Include principles with `warning` or `fail` outcomes and all `not assessed` coverage gaps. State the missing evidence for gaps.
   - Order assessed findings by outcome severity first (`fail` before `warning`), then by hierarchy importance. List coverage gaps afterward in hierarchy order. Title status emoji + name using the mapping above.
   - If all principles pass with complete coverage, include `Details` with `No warnings or failures.`
   - Scope also records mode, coverage gaps, applied versus proposed remedies, validation results, and unresolved work.
   - For each coverage gap, state unexamined units, missing evidence, and remaining checks. Do not invent a finding or remedy.
   - Give each principle with a supported finding its own subsection using this exact structure:

   ## <status emoji> <principle name>

   ### Finding
   Reference stable finding IDs. Describe each underlying issue once under its first applicable principle.
   Other applicable principle sections reference those IDs without counting new findings.

   ### Problem
   Concrete evidence with specific files, functions/symbols, and line references when available.

   ### Solution
   implementation-ready changes. Be specific about what to add, remove, move, or rename; include concrete file paths and recommended function/interface/module updates.

## Quality summary

This is an unranked summary criterion, not another principle, review pass, result, finding, method, or route.
Reuse the completed 17-principle review and its stable finding IDs. Do not inspect additional scope for this summary.
Do not propose changes merely for aesthetics or require a readability change in every touched file.

### Meaning and evidence

Use meaningful names, focused methods, and clear structure so the code communicates intent with low cognitive load.
Summarize cohesion, clarity, and testability from the completed review:

- Cohesion: cite [separation of concerns](principles/2-med/06-separation-of-concerns.md) and [SRP](principles/2-med/07-single-responsibility.md) findings about ownership and method boundaries.
- Clarity: cite [KISS](principles/1-high/04-kiss.md), [least surprise](principles/1-high/03-principle-of-least-surprise.md), and [consistency](principles/2-med/10-be-consistent.md) findings about names, branching, and explicit inputs/outputs.
- Testability: cite [Make It Work](principles/1-high/01-make-it-work.md) and [dependency inversion](principles/2-med/09-dependency-inversion.md) findings and supplied test evidence or gaps. Do not claim tests ran.

Readability improvements apply after behavior is stable and within the reviewed naming and method boundaries.
Good naming and decomposition make business intent obvious. Cosmetic changes can still hide unnecessary complexity.
Correctness takes precedence over readability. Improve readability only in constrained, justified increments.

### Summary guidance

Use existing evidence about domain-relevant identifiers, function focus, minimal branching, and explicit inputs/outputs.
Include existing findings about comments that compensate for unclear code and alternatives that make intent explicit.
Mention supported local improvements such as naming, extraction, dead-code removal, or tests without creating compulsory cleanup.
Reference existing finding IDs rather than repeating findings or remedies. State gaps when the completed review lacks evidence.
Include one short unranked summary in the existing report's Scope section. Do not add a ranked status or another report section.
