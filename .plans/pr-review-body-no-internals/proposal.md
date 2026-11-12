# Proposal: keep `/pr review` process detail out of published reviews

Status: implemented. Static validation passed: `bash install/tests/skill-links.test.sh`, `bash install/tests/agent-drift.test.sh`, and `bash install/tests/install.test.sh`.

## Outcome

A review published on another author's PR contains code-facing findings and verdict only. The invoking session receives process facts separately.

## Acceptance

- **A1**: When `/pr review` publishes a body or inline comment, then it permits only the disclosure, hidden `pr-review` marker, verdict, code findings, and code-evidence gaps. Check: static read-through of `skills/dev/pr/references/review.md`. (`code`)
- **A2**: When packet coverage is incomplete and the event is `COMMENT`, then the published body omits the process reason for that event. Check: static trace of publication steps 2 through 5. (`code`)
- **A3**: When the caller needs review depth, models, validator results, or process gaps, then `Output Style` names the caller report as the sole destination. Check: static read-through of `review.md`. (`code`)
- **A4**: When a body is ready to post, then step 5 requires rereading it and removing process sentences without changing deduplication. Check: static read-through of step 5. (`code`)
- **A5**: When the repository checks run, then installer and skill-link regressions pass. Check: `bash install/tests/skill-links.test.sh`, `bash install/tests/agent-drift.test.sh`, and `bash install/tests/install.test.sh`. (`code`)

## Decisions

- 2026-03-09: Limit the implementation to `skills/dev/pr/references/review.md`. The diagnosed issue is localized there. Related files define caller reporting or disclosures but do not direct this publication body to include process facts.
- 2026-03-09: Preserve the marker payload and publication event rules. They are machine contracts and approval safeguards outside the privacy fix.

## Evidence

- The reported GitHub review body includes validator failure, review depth, completed rows, and model/isolation details: `gh api repos/Checkfront/guest-widgets/pulls/575/reviews` filtered to review `5877738453`.
- `skills/dev/pr/references/review.md` publication steps 2 and 3 direct coverage-gap disclosure and limitations in the body; its Output Style combines caller-report process facts with publication instructions.
- `AGENTS.md`, `README.md`, `install.sh`, and `harness/pi/README.md` identify installer and skill-link checks.

## Approach

Make one documentation-only change in the other-author publication section. Define the allowed PR-body content, distinguish code-evidence gaps from process facts, keep the marker, and add a body sanitization check to existing step 5. Label Output Style as the caller report and exclude it from the PR body.

## Risks and unknowns

- Overbroad wording could conceal code-evidence gaps. Keep code-specific gaps permitted and give a concrete example.
- The new wording must not weaken approval selection or deduplication. Keep step 4 and existing step 5 mechanics unchanged.

## Out of scope

- Changing approval rules, payload format, deduplication, comments-thread replies, or other review behavior.

## Open questions

None.
