# Drift

## Scope

Inspect only design documents whose row in the owning plan README `## Design` index has status `Approved`. A draft, done, missing, or ambiguous row is not a specification; skip it and record the reason.

## Workflow

1. Use the plan folder the user names or that holds the target document. Otherwise resolve the base with `plan-dir` and scan each plan folder's README under it. Identify approved design rows.
2. For each approved document, read the document and only the source files or symbols it explicitly references. Compare intended behavior with current code using [re-implementation](standards/re-implementation.md).
3. Report differences only: missing behavior, incomplete models, changed interfaces, logic shortcuts, incompatible configuration, or architectural divergence. Do not report matching work.
4. Write one dated drift report in the plan folder that owns the approved document, not the repository root or current directory. Group findings by document and include document evidence, code evidence, impact, and an open resolution choice: update code, update specification, or accept divergence.
5. Register the report as `egm-drift`, status `done`, and stop for human review. Do not modify code or specifications.

## Report

```markdown
# Drift report: <date>

## <approved design>

- **Finding:** <difference>
  - Document: <section or claim>
  - Code: <file and symbol>
  - Impact: <effect>
  - Resolution: update code | update specification | accept divergence

## Skipped documents
```
