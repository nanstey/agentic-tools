# Drift

## Scope

Inspect only design documents whose own `Status` is `Approved`, or whose `## Decision record` explicitly approves the design. A draft, missing, or ambiguous status is not a specification; skip it and record the reason.

## Workflow

1. Use the directory or target document the user names. Otherwise resolve the base as in `SKILL.md`. Scan plan files there and identify approved design documents by their `Status` or `## Decision record`.
2. For each approved document, read the document and only the source files or symbols it explicitly references. Compare intended behavior with current code using [re-implementation](standards/re-implementation.md).
3. Report differences only: missing behavior, incomplete models, changed interfaces, logic shortcuts, incompatible configuration, or architectural divergence. Do not report matching work.
4. Write one dated drift report beside the approved document, not the repository root or current directory. Group findings by document and include document evidence, code evidence, impact, and an open resolution choice: update code, update specification, or accept divergence.
5. Set the report status to `Done` and stop for human review. Do not modify code or specifications.

## Report

```markdown
# Drift report: <date>

- Status: Done

## <approved design>

- **Finding:** <difference>
  - Document: <section or claim>
  - Code: <file and symbol>
  - Impact: <effect>
  - Resolution: update code | update specification | accept divergence

## Skipped documents
```
