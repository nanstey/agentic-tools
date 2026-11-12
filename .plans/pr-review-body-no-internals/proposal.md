# Proposal: keep `/pr review` process detail out of published reviews

Status: implemented. Static validation passed: `bash install/tests/skill-links.test.sh`, `bash install/tests/agent-drift.test.sh`, and `bash install/tests/install.test.sh`.

## Outcome

A review published on another author's PR contains code-facing findings and verdict only, for the PR author and other reviewers. The invoking session receives process facts, decisions, and next steps only in its caller report.

## Acceptance

- **A1**: Published bodies and inline comments allow only the disclosure, hidden `pr-review` marker, verdict, code findings, code-evidence gaps, and neutral PR decision statements; they exclude invoker-facing reports/directives. Check: static trace of publication steps 2 and 5. (`code`)
- **A2**: Published decision wording is neutral. Who must decide, invoker next steps, and why no approval was given appear only in the caller report. Check: static trace of step 2 and `Output Style`. (`code`)
- **A3**: The marker is v2 and hashes only full head, event, and a sorted stable-ID findings array; its displayed findings field is comma-joined. Check: static read-through of publication step 3. (`code`)
- **A4**: Step 5 deduplicates at the current head only against valid matching v2 markers or digest-validated v1 markers with equal full head, event, and sorted findings. Check: static read-through of step 5. (`code`)
- **A5**: Incomplete `COMMENT` bodies omit the process reason, while code-evidence gaps and the closest-applicable changed-hunk inline-comment preference remain permitted. Check: static trace of publication steps 2 through 5. (`code`)
- **A6**: Repository checks pass. Check: `bash install/tests/skill-links.test.sh`, `bash install/tests/agent-drift.test.sh`, and `bash install/tests/install.test.sh`. (`code`)

## Decisions

- 2026-03-09: Limit the implementation to `skills/dev/pr/references/review.md` and this proposal. Related files do not need changes.
- 2026-03-09: Use a minimal v2 marker containing only head, event, and stable finding IDs. Hash a sorted stable-ID array. Retain v1 only for digest-validated deduplication compatibility.
- 2026-03-09: Keep approval selection, snapshot checks, POST behavior, retries, and anchored inline-comment preference unchanged.

## Evidence

- The reported GitHub review body includes validator failure, review depth, completed rows, and model/isolation details: `gh api repos/Checkfront/guest-widgets/pulls/575/reviews` filtered to review `5877738453`.
- `skills/dev/pr/references/review.md` previously emitted a v1 marker carrying packet/process data and deduplicated identical payloads.
- `AGENTS.md`, `README.md`, `install.sh`, and `harness/pi/README.md` identify installer and skill-link checks.

## Approach

Update the other-author publication section only. Separate author/reviewer-facing PR content from the caller report, retain code-evidence gaps and anchored inline comments, replace v1 emission with the compact v2 contract, and validate both versions during current-head deduplication.

## Risks and unknowns

- Overbroad wording could conceal code-evidence gaps. Keep code-specific gaps permitted and give a concrete example.
- Marker normalization errors could create duplicate reviews. Specify sorting, hash input, and v1/v2 validation precisely.

## Out of scope

- Changing approval rules, snapshot checks, POST/retry behavior, comments-thread replies, or other review behavior.

## Open questions

None.
