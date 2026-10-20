# Smells

Diagnose smells, choose techniques, and plan remedies under the caller's [execution context](../REFERENCE.md#execution-context), which controls mode, authority, scope, evidence reuse, and validation. Follow `CLAUDE.md` / `AGENTS.md`. Selection and planning are internal stages, not commands or approval gates.

Load the [smell index](smells/index.json) first; load a smell detail only for an applicable family, then shortlisted `techniques/<family_id>/<technique-id>.md` and `technique-map/` only when selecting its remedy. Paths are relative to this file; index paths resolve from their index directory. Load [schemas](../REFERENCE.md#dataset-layout-and-schemas) only when validating dataset data.

## Diagnose

Inputs: review scope, language/framework context, mode, source identity, caller constraints, existing findings, and required coverage/depth. Use catalog IDs only unless the user authorizes additions.

1. Examine applicability of every catalog smell family across the resolved scope. Cover all applicable families for bare exhaustive and selected smells reviews. Prioritization orders work and never limits coverage.
2. Load the smell hierarchy and resolve IDs.
3. Reuse matching findings and evidence before inspecting uncovered material. Use the single DRY/SRP procedures in [extract.md](extract.md) for duplicate-code and responsibility findings, not another scan.
4. Rank severity (`high`/`medium`/`low`) and include one intentional non-finding.
5. Verify every finding maps to a catalog ID and concrete code evidence.

Safety:

- Never label a smell without evidence in the reviewed code.
- Never demand broad refactors when a localized fix addresses the risk.
- Never manufacture findings to fill categories. Record non-applicable families with rationale and unexamined checks as gaps. No finding is not completed coverage.
- Never invent smell IDs outside `smells/index.json` without user approval.

## Select techniques

Return one primary technique and an optional fallback per smell. Inputs: smell IDs, evidence location per smell, constraints and hard boundaries.

1. Validate each smell entry (`smell_id`, `evidence_location`, constraints).
2. Shortlist from each smell's `related_refactorings`, then use `technique-map/smell-to-technique.json` for relationships and sequencing.
3. Load detail files for top candidates. Rank by evidence fit, constraints, risk, and reversibility.
4. Return per smell: primary technique with rationale, optional fallback with trigger, a concrete improvement suggestion, and confidence.

Safety:

- Never drop smells silently. If capacity is exceeded, process in explicit chunks and report the remaining count.
- Never recommend a technique without mapping evidence unless the user approves a fallback strategy.
- If a technique detail file is missing, state reduced confidence and leave unsafe recommendations unresolved. Do not guess a fix from metadata alone.
- Never hide low confidence. Ask only when explicit authority or a consequential decision is required.
- Never produce architecture-wide recommendations when a local technique is enough.

## Plan

Planning is an internal stage, not a public command or separate authorization gate. Aggregate actionable findings into an ordered implementation checklist. In fix mode, return supported remedies for authorized implementation and validation without another approval cycle. In report mode, write a report or plan artifact only when requested and permitted, never target source or follow-on implementation. Inputs: findings with stable recognized finding IDs and evidence, scope, source identity, constraints, permissions, an optional permitted artifact path, and plan quality criteria.

1. Validate finding IDs, evidence, constraints, remedies, risks, and validation steps under the [reference validation rules](../REFERENCE.md#validation-and-fast-path).
2. For a smell-ID finding, choose a path:
   - standard: run Select techniques per smell,
   - fast path: accept direct technique input only if fully validated.
3. For every other finding, retain its stable ID and select a remedy from its evidence and constraints without requiring a smell ID.
4. Aggregate recommendations, confidence where applicable, risks, and validation steps into the checklist.
5. Report unresolved findings explicitly. Write an artifact only when requested and permitted by the caller.

Keep all evidence, constraints, primary/fallback recommendations where applicable, rationale, confidence, and unresolved findings in the aggregated report.

Safety:

- Never skip technique selection for actionable smell findings unless fast-path validation passes completely.
- Never synthesize recommendations that contradict validated direct input.
- Never emit a "complete" result if an actionable finding lacks evidence or a supported remedy.
- Never promote report mode into source changes or plan execution. Fix mode uses existing caller authority and the shared safety rules, not authority from the checklist.

## Output

After the root summary, report scope, evaluated categories/smells, grouped findings with evidence and related refactors, severity-ranked top actions, one intentional non-finding, and per-smell technique recommendations with confidence. Add processed/unresolved finding counts, the execution path (`standard`/`fast path`/mixed), and a requested permitted artifact path when written. Include at most one clarification question.
