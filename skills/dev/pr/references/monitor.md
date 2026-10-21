# PR Monitor

## Core Contract

`pr-monitor` is the sole PR reconciliation engine. It accepts `mode: monitor` (default) or `mode: once`; both execute the same cycle for one verified open PR. Load [`gates.md`](gates.md), inherit its packet/findings/three-round state, and bind outcome, review, and expected-CI evidence to authoritative base/head and trusted policy. Monitor owns health/CI/threads, consumes current review state, and requests only missing/invalidated source coverage; never duplicate full reviews or recurse into `/pr`.

The engine returns one of:

- `clean`: the PR is ready for review (not a draft), and a final unchanged-base/head/policy snapshot confirms observed acceptance outcomes, complete quality/security coverage, no unresolved verified requests or threads, and all expected readiness-required CI passed (or policy-verified not applicable);
- `pending`: no blocker remains and another cycle is required, including when required CI for the current head is queued, pending, or in progress; this is not success; or
- `blocked`: a delegate stop gate, non-actionable feedback, external failure, validation failure, unexpected working-tree state, authentication/rate-limit problem, ambiguous PR, or no-progress condition prevents safe completion.

`once` returns immediately after one cycle and never sleeps. `monitor` returns on `clean` or `blocked`; on `pending`, it waits for the configured interval (60 seconds by default) before another cycle.

Within existing authorization, the cycle fixes verified requests from threads/CI only when a next review round is available. Optional nits need separate explicit selection/authorization. Risky/product decisions, no progress, exhausted rounds, failed reviewers/checks, and material evidence gaps stop blocked with the needed next action; no forced fixes or budget reset.

Delegate to `/pr info`, `/pr comments`, `/pr ci`, `/pr ready`, `/pr rebase` (or its required `/pr stack` handoff), and `/pr description`. Do not reproduce their remediation, validation, publication, thread-finalization, or screenshot internals; preserve every delegate's safety and stop gates.

## Required Inputs

1. `mode`: `monitor` (default) or `once`.
2. PR URL or number when supplied; otherwise the current branch.
3. Optional polling interval for `monitor` (default: 60 seconds).
4. Any explicit scope or stop condition from the user.
5. Current acceptance/outcome and validator evidence, trusted policy/expected checks, review packet, and inherited round state. Recover state before remediation rather than assume a new budget.

## Reconciliation Cycle

1. Invoke `/pr info` to verify one open PR, branch/repository, and authoritative entry base/head. Stop on its no-PR, ambiguity, branch-mismatch, closed/merged, or other gate. Recover current policy/round state and invalidate stale readiness/approval evidence.
2. Snapshot the entry state with `/pr comments` in snapshot-only mode, expected required checks/dependencies from `ci.md`, outcome evidence, and current quality/security packet. Surround observations with `/pr info` and require unchanged base/head/policy. No observed checks is not success; missing expected-policy evidence is blocked.
3. Triage actionable threads through `/pr comments` with commits, pushes, replies, and resolutions deferred. Pass the shared state. It source-verifies candidates and may stage narrow authorized request fixes only after reserving a next round. Stop on its blockers; optional nits/unchanged existing issues do not compel fixes.
4. For completed failing required checks, invoke `/pr ci` with commits/pushes deferred and the same reserved-round/batch state. It investigates and may stage narrow code fixes after validation. Do not retry failures without its evidence/safety decisions; do not run downstream quality/security gates while outcome or independent required CI fails.
5. Batch related remediation into one validated fix head, commit once, and publish once via `/pr push` for local remediation, or via `/pr rebase` for required base/native-stack synchronization (then `/pr push` post-push steps for that head). Honor its `/pr stack` handoff. Reserve the next round before head-changing synchronization; never exceed round 3 or publish intermediate heads. Stop on validation/sync/publication failure. Assign the changed head its reserved round, refresh authoritative base/head/policy, and revalidate outcomes/independent CI. Request [`/review-code report`](../../../workflow/review-code/SKILL.md) over delta and affected paths/checks with current validation evidence and inherited `round_state`. Retain findings/evidence; broad base/policy changes require full reassessment without reset. Source reviewers never test/edit; validators remain separate.
6. Run `/pr description` once for the cycle's entry head when no publication occurred. A head published through `/pr push` is already described by it. This is description-once-per-head: across monitor cycles, do not run it again for an already-described head. Preserve its mandatory screenshot handling and stop gates.
7. Complete any missing/invalidated outcome → independent required CI → quality → security → automated-review-dependent required CI coverage in order, reusing exact matching packets. Do not repeat full reviews of a matching snapshot. Invoke `/pr comments` to finalize deferred replies/resolutions only after publication and affected validation/review gates pass at the current base/head; keep blocked requests/gaps unresolved.
8. Resnapshot `/pr info`, threads, outcomes, quality/security evidence, and expected required CI. External/remote head changes invalidate readiness/approval and require the next inherited round. If that next round is available, admit the new head once, persist its assigned round, and return `pending` for affected-gate reassessment; otherwise blocked. Do not charge the same admitted head again in the next cycle. Base/policy changes invalidate applicable evidence too; broad changes require full reassessment, never a fresh budget.
9. Classify the resnapshot:
   - queued/running required CI with complete policy evidence and no blocker is `pending`, not success;
   - unresolved verified requests, missing material evidence, failed reviewers/checks, exhausted rounds with required work left, or unchanged/non-actionable feedback are `blocked`; newly actionable authorized requests may continue only within the inherited budget;
   - otherwise take one final complete snapshot. Return `clean` only for identical base/head/policy, complete current outcome/quality/security evidence, all expected readiness-required checks passed or policy-verified not applicable, and no unresolved requests/threads. Incomplete/error snapshots are blocked, never clean.
10. Draft transition: if all readiness prerequisites pass but `isDraft` is true, invoke `/pr ready` with current evidence/state once per monitor invocation, unless user scope forbids it. Never convert to trigger missing required checks: use a supported draft/manual trigger or explicitly authorized configuration change, otherwise blocked. On conversion return `pending`, then re-observe the ready PR in the next cycle/invocation; do not infer approval/merge permission. A failed ready gate or an unexpected return to draft by another actor is blocked. A draft made by this run under the draft-before-changes rule in `gates.md` is expected: finish the fixes, then use this step.

## GitHub Implementation Notes

- `/pr info` is authoritative for PR number, repository, and `headRefOid`; never infer the head from a local ref.
- Discover expected checks and classify dependencies with `ci.md`; query observed jobs with `gh pr checks <number> --required`. Accept results only when surrounding `/pr info` snapshots confirm unchanged base/head and trusted policy. Empty results are not proof of no expected checks.
- Required jobs must satisfy their policy obligation. Pending/queued/running states are not success; failed/cancelled/timed-out/action-required jobs require `/pr ci`. Skipped/neutral jobs need trusted applicability evidence, not a blanket terminal-state pass.
- Treat pagination, authentication, rate-limit, API, or incomplete-data failures as `blocked`; never infer clean state from incomplete feedback or CI data.
- In `monitor` mode, sleep with `sleep <interval-seconds>` only after a `pending` cycle. Never use a watch mode that hides the head OID or bypasses same-head confirmation.

## Safety Rules

- Never reconcile an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never treat stale-head, pending, queued, or in-progress CI as success.
- Never duplicate delegate internals, bypass a delegate's stop gate, publish partial remediation, or force-push outside `/pr rebase` or its stack handoff.
- Never reply to or resolve review feedback before its remediation is published.
- Never spin: do not re-dispatch unchanged feedback or failures without new evidence, and stop on inherited stop gates or non-progress.
- Never mark ready except through `/pr ready` after complete current prerequisite evidence, or merely to trigger required CI; never more than once per invocation.
- Never reset the shared budget, run recursive lifecycle/review loops, or produce an unreviewable fix head.
- Never return `clean` for a draft PR, a clean source packet alone, or without final complete unchanged-base/head/policy evidence.

## Output Style

Report PR/mode/result, final base/head/policy, outcome and expected-CI/dependency evidence, packet freshness/quality/security coverage, retained/request IDs, round state, waits, and blockers. Include local remediation/publication, deferred thread finalization, description update, and ready transition; name the exact missing evidence/trigger or next action.
