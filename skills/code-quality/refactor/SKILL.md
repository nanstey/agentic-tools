---
name: refactor
description: Routes scoped refactor work to inspection, extraction planning, simplification, or an implementation plan. Use when choosing or coordinating a refactor method without implicit source edits.
user-invocable: true
disable-model-invocation: false
argument-hint: "[inspect|extract|simplify|plan] [scope]"
---

# Refactor

## Core Contract

Select one explicit route and reuse its specialist method. Do not run a pipeline or unrelated specialists by default.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.
Bare `/refactor` requests route selection only. Present the routes and stop until the user selects one.
Never infer source-edit permission from the command name, a smell report, or an implementation checklist.

## Required Inputs

1. Explicit route: `inspect`, `extract`, `simplify`, or `plan`.
2. Scope, repository constraints, and intended outcome. Use `scope` if boundaries are missing.
3. Existing findings/evidence for planning, or selected cuts and separate edit authorization for simplification.
4. Desired report/plan path, if the user requests an artifact.

## Workflow

1. Resolve the route and scope before invoking a specialist. Read the selected method and pass the route's permissions explicitly.
2. Execute only the selected route:

   | Route | Method and output | Mutation boundary |
   | --- | --- | --- |
   | `inspect` | [sniff](../sniff/SKILL.md): evidence-backed diagnosis, reference smell IDs, severity, and intentional non-finding. | Read-only source inspection. No fixes. |
   | `extract` | [extract](../extract/SKILL.md) alias: shared DRY/SRP method and concrete extraction/placement report. | Planning only. No source edits or automatic implementation. |
   | `simplify` | [ponytail lite](../ponytail/SKILL.md): report candidate cuts for the scoped branch diff. | Report first, apply nothing. Only a later explicit selection and edit authorization permits those selected cuts. |
   | `plan` | [preserved planning method](references/plan.md): validate findings, use `fresh-air` or validated direct techniques, aggregate and author the plan. | Write the requested plan artifact only. No source edits or follow-on execution. |

3. Preserve specialist detail. Extraction reports require `same file`, `other file`, or `new file`, concrete locations, and placement rationale.
   Planning retains local reference IDs, fast-path validation, recommendations, confidence, risks, and unresolved findings.
   Manual [DRY](../dry/SKILL.md), [SRP](../srp/SKILL.md), and [principles](../principles/SKILL.md) lenses remain available when selected.
   [deep-review](../deep-review/SKILL.md) remains a separate structural review method; do not replace it with a smell scan.
4. Return the selected route's report or artifact. Do not chain diagnosis into planning or planning into implementation without an explicit request.

## Safety Rules

- Never invoke the default full simplification mode from this router. `simplify` starts with `lite` even when the branch has changes.
- Never run a broad repository audit by default. A separately requested audit is report-only under the specialist's audit method.
- Never change source during `inspect`, `extract`, or `plan`. Implementation imperatives in a report define planning scope, not execution authority.
- Never invoke follow-on implementation from an extraction or plan artifact. Stop for explicit user review after the artifact.
- Never apply simplification cuts without first reporting them and obtaining explicit authorization for selected cuts.
- When edits are authorized, preserve behavior and safeguards, stay within the selected scope, validate narrowly, and revert failing cuts.
- Never treat authorization to edit as authorization to commit, push, post comments, or approve.
- Never delete specialist methods, reports, references, or datasets as part of routing.

## Output Style

Report route, scope, mutation permission, findings/unresolved items, and artifact path when written.
For bare invocation, present the four choices without running them.
For authorized simplification edits, distinguish reported, selected, applied, and merely proposed cuts plus validation results.
