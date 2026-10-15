# PR Ready

## Core Contract

Convert one verified open draft PR to ready-for-review once its current head is clean. Read-only apart from that conversion; never remediates (`/pr ci` and `/pr comments` own that).
Some repos run the full CI suite only on ready PRs, so a clean draft is not a finished PR: after conversion the caller must re-observe the head (`/pr monitor`).
Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL or number when supplied; otherwise the current branch.

## Workflow

1. Invoke `/pr info` to resolve and verify one open PR; record `number`, `isDraft`, `headRefOid`. Stop on its stop gates.
2. If `isDraft` is false, report `already ready` and stop successfully without changes.
3. Snapshot required CI for `headRefOid` (`gh pr checks <number> --required`). Stop as blocked on any failing, cancelled, timed-out, action-required, queued, pending, or in-progress check. Reported "no checks" passes this gate: CI may be gated on ready; record "CI not yet run on draft".
4. Snapshot unresolved review threads (see `merge.md` implementation notes). Stop as blocked if any remain.
5. Re-run `/pr info`; stop if `headRefOid` changed since step 1.
6. Run `gh pr ready <number>`, then re-read the PR and require `isDraft` false.
7. Report that the full CI suite may now be running and that `/pr monitor` must observe the ready head next.

## Safety Rules

- Never convert an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never convert with failing or non-terminal required CI, or unresolved review threads.
- Never remediate, retry CI, reply to threads, edit title/description, push, or change local git state.
- Never convert back to draft.
- Treat authentication, rate-limit, API, or incomplete-data failures as blockers.

## Output Style

Report the verified PR, whether it was converted or already ready, the CI and thread snapshot, the head OID, and any blocker. State that a follow-up `/pr monitor` is required.
