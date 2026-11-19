# Re-request review after self-remediation

## Outcome
When `/pr comments` remediates a PR authored by the authenticated user, it re-requests review from eligible prior human reviewers only after every outstanding PR review comment is addressed and the fix is pushed. Eligible reviewers include reviewers with addressed triaged `request` threads and latest review `COMMENTED` or `CHANGES_REQUESTED`; other prior reviewers qualify only with latest review `CHANGES_REQUESTED`. The PR author is never re-requested.

## Acceptance
- A1. When the comments workflow is read, re-request is gated on own-PR ownership, a fix published via `/pr push`, all outstanding PR review comments addressed, and all of the eligible reviewer's requested-change threads resolved with none declined or unaddressed. Check (`code`): `grep -n 'rerequest' skills/dev/pr/references/comments.md` shows one re-request step located after the publish and resolve steps; global and per-reviewer gating phrases are present in that step.
- A2. When eligibility is read, the PR author (authenticated viewer) is explicitly excluded, as are bots, teams, and already-requested reviewers. Check (`code`): grep the step for "author", "bots", "teams", "already-requested".
- A3. When the snapshot inputs are read, they name the data needed to decide eligibility: reviewer login, user-vs-bot type, latest review state per reviewer (`COMMENTED` or `CHANGES_REQUESTED`), PR author login, and current requested reviewers. Check (`code`): grep the step for those terms.
- A4. When the safety rules are read, "never re-request an ineligible reviewer" and "never dismiss a review" remain. Check (`code`): grep Safety Rules.
- A5. When callers are read, `lifecycle.md` phase 7 and `monitor.md` still invoke `/pr comments` without a duplicate re-request implementation. Check (`code`): `grep -n 'rerequest' skills/dev/pr -r` matches only `comments.md`.
- A6. When the installer suite runs it passes, and the README catalog and SKILL.md frontmatter are unchanged. Check (`code`): `bash install/tests/install.test.sh`; `git diff --stat` lists only `comments.md` (plus the plan).

## Decisions
- 2026-10-03: Change only `comments.md` and keep it concise (a few edited clauses, no new section). README is untouched because frontmatter is unchanged.
- 2026-10-03: "Appropriate prior human reviewers" includes individual non-bot users other than the PR author with addressed triaged `request` threads and latest review `COMMENTED` or `CHANGES_REQUESTED`; additional prior reviewers qualify only with latest review `CHANGES_REQUESTED`. Re-request is globally gated on all outstanding PR review comments being addressed.

## Assumptions
- The existing GitHub REST `requested_reviewers/rerequest` endpoint and GET verification remain the mechanism.
- `.plans/<effort>/plan.md` is the plan convention.

## Evidence
- `skills/dev/pr/references/comments.md` lines 15-32: ownership check (step 4), publish via `/pr push` (step 6), resolve after confirmed publication (step 7), rerequest and GET `requested_reviewers` verification, skip on API failure or pagination gaps.
- Gap: author exclusion is implicit; step 2 and 7 do not say the snapshot must carry reviewer type/bot status, latest review state per reviewer, or PR author login.
- `lifecycle.md` phase 7 calls `/pr comments`; `monitor.md` defers then invokes it after publication.

## Approach
Edit `skills/dev/pr/references/comments.md` only:
1. Step 2: require the snapshot to include per-thread reviewer login and type (User vs Bot/Organization), each reviewer's latest review state, the PR author login, and current requested reviewers, fully paginated.
2. Step 7 re-request bullet: explicitly gate all re-requests on every outstanding PR review comment being addressed. Eligibility includes individual non-bot users other than the PR author with addressed triaged `request` threads and latest review `COMMENTED` or `CHANGES_REQUESTED`; additional prior reviewers qualify only with latest review `CHANGES_REQUESTED`. Preserve the per-reviewer published-fix/thread conditions, base/head stability, exclusions, and skip rules.
3. Confirm Safety Rules still cover it; add no duplicate text elsewhere.
Then run the A1-A6 checks and report the result. Do not commit or open a PR.

## Risks and unknowns
- Wording growth: keep the net addition to a few clauses.
- Latest-review state requires the reviews API, not threads alone; the wording must name it so the executor fetches it.
- Re-request on the author's own login would error or be a no-op; the explicit exclusion prevents it.

## Out of scope
Changing `lifecycle.md`, `monitor.md`, `review.md`, README, SKILL.md frontmatter, installer, or the re-request mechanism.

## Open questions
None.
