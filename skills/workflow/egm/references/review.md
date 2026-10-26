# Review

## Goldfish Input

Give each fresh, read-only Goldfish only the target document, its explicitly referenced files, the current stage prompt, and the relevant standard. Do not provide Elephant conversation history or conclusions. Prefer another model family from the drafter when available.

Ask each Goldfish to return a findings table graded `Blocker`, `Major`, or `Nit`, then a final line `STAGE: PASS` (no Blocker or Major) or `STAGE: FAIL`. The Elephant still re-grades after deduplication.

## Workflow

1. Confirm the document and referenced-file set. Start a review record beside the document in its plan folder.
2. Run stages in order: **zoom-out**, **comprehension**, **critic**, **zoom-out**, **readiness**. Use the matching persona and standard.
3. The Elephant deduplicates findings and grades them `Blocker`, `Major`, or `Nit`. A stage passes only with no Blocker or Major.
4. For every finding, record one disposition: `CONTEST` with document or code evidence, or `PROPOSE FIX` with a proposed document change. The coordinator performs this work; do not use a synthesis reviewer.
5. Allow at most two rounds per stage. After that, record unresolved items as accepted trade-offs with the human decision and proceed only with approval.
6. Pause for a human gate after each stage. With `--auto`, run all stages and present one consolidated gate instead.
7. With `--polish`, run structural and style personas after readiness. Do not run duplicate A/B reviewer sets by default.
8. Register the review record as `egm-design`, status `done`; set the document row to `Approved` only after human approval.

## Independent Diagnosis

For a bug write-up, run one separate Goldfish diagnosis using only the symptom and reproduction steps. Hide the Elephant's suspected cause. Compare its root cause with the Elephant hypothesis and record agreement, disagreement, and supporting evidence.

## Review Record

```markdown
# Review: <document>

## Stage: <name>
| Severity | Scope | Finding | Evidence | Disposition |
| --- | --- | --- | --- | --- |

## Accepted trade-offs
## Independent diagnosis
## Decision
```
