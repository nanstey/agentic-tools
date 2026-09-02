---
name: pr-monitor
description: Reconciles one verified open PR to a stable review-ready state. Use when a PR needs active supervision through review and required CI completion.
user-invocable: true
disable-model-invocation: false
---

# PR Monitor

## Core Contract

`pr-monitor` is the sole PR reconciliation engine. It accepts `mode: monitor` (default) or `mode: once`; both execute the same reconciliation cycle. The cycle works on exactly one verified open PR and binds every review and required-CI observation to its current `headRefOid`.

The engine returns one of:

- `clean`: a final same-head resnapshot confirms no unresolved review feedback and every required check is terminal and non-failing;
- `pending`: no blocker remains and another cycle is required, including when required CI for the current head is queued, pending, or in progress; this is not success; or
- `blocked`: a delegate stop gate, non-actionable feedback, external failure, validation failure, unexpected working-tree state, authentication/rate-limit problem, ambiguous PR, or no-progress condition prevents safe completion.

`once` returns immediately after one cycle and never sleeps. `monitor` returns on `clean` or `blocked`; on `pending`, it waits for the configured interval (60 seconds by default) before another cycle.

Delegate to `pr-info`, `pr-comments`, `pr-ci`, `pr-rebase` (or its required `gh-stack` handoff), and `pr-description`. Do not reproduce their remediation, validation, publication, thread-finalization, or screenshot internals; preserve every delegate's safety and stop gates.

## Required Inputs

1. `mode`: `monitor` (default) or `once`.
2. PR URL or number when supplied; otherwise the current branch.
3. Optional polling interval for `monitor` (default: 60 seconds).
4. Any explicit scope or stop condition from the user.

## Reconciliation Cycle

1. Invoke `pr-info` to resolve and verify one open PR, its branch, repository, and entry `headRefOid`. Stop on its no-PR, multiple-PR, branch-mismatch, closed, merged, or other stop gate.
2. Snapshot the entry head:
   - use `pr-comments` to snapshot unresolved review threads and determine whether any thread is actionable;
   - query that PR's required CI as described in GitHub Implementation Notes; and
   - surround the snapshot with `pr-info` so the observed feedback and checks are accepted only if the head remains the entry `headRefOid`.
3. For actionable review threads, invoke `pr-comments` with pushes, replies, and resolutions deferred. Let it triage, make minimal local remediation, validate, and commit when appropriate. Stop if it identifies blocked or non-actionable feedback.
4. For completed failing required checks, invoke `pr-ci` with pushes deferred. Let it investigate, classify, make minimal local remediation, validate, and commit when appropriate. Do not retry a failure without the evidence and safety decisions required by `pr-ci`.
5. Batch all remediation before publication. Publish exactly once, using `pr-rebase`, only when local remediation changes exist or base or native-stack synchronization is required; if `pr-rebase` identifies a native stack, use its required `gh-stack` handoff instead. Do not make intermediate pushes. Stop if synchronization, validation, or publication stops or fails.
6. Run `pr-description` once for the cycle's entry head when no publication occurred, or once for the published head when it did. This is description-once-per-head: across monitor cycles, do not run it again for an already-described head. Preserve its mandatory screenshot handling and stop gates.
7. Once the relevant branch state is confirmed published, invoke `pr-comments` to finalize deferred replies and resolutions. Use the newly published head when publication occurred; otherwise use the already-published verified entry head. Keep blocked feedback unresolved as that skill requires.
8. Resnapshot with `pr-info`, unresolved-review discovery, and current-head required CI. If the head changed outside the single publication, discard prior observations and return `pending` unless a stop gate applies; the next monitor cycle or invocation will reconcile the new head.
9. Classify the resnapshot:
   - if any required check is queued, pending, or in progress and no actionable remediation remains, return `pending`;
   - if unresolved feedback remains, dispatch it only when it is new actionable feedback; otherwise return `blocked` for non-progress;
   - if all required checks are terminal and non-failing and no unresolved feedback remains, take one final complete resnapshot. Return `clean` only when that confirmation reports the identical head OID and the same clean conditions; otherwise return `pending` for a changed/pending head or `blocked` for an incomplete/error snapshot.

## GitHub Implementation Notes

- `pr-info` is authoritative for PR number, repository, and `headRefOid`; never infer the head from a local ref.
- Query required checks with `gh pr checks <number> --required`. Accept the output only when surrounding `pr-info` snapshots confirm the same `headRefOid`; otherwise discard it.
- A required check is clean only when terminal and non-failing. `pending`, `queued`, `in_progress`, and equivalent waiting states are `pending`, not success. Failed, cancelled, timed-out, action-required, or otherwise failing terminal states require `pr-ci`.
- Treat pagination, authentication, rate-limit, API, or incomplete-data failures as `blocked`; never infer clean state from incomplete feedback or CI data.
- In `monitor` mode, sleep with `sleep <interval-seconds>` only after a `pending` cycle. Never use a watch mode that hides the head OID or bypasses same-head confirmation.

## Safety Rules

- Never reconcile an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never treat stale-head, pending, queued, or in-progress CI as success.
- Never duplicate delegate internals, bypass a delegate's stop gate, publish partial remediation, or force-push outside `pr-rebase` or its stack handoff.
- Never reply to or resolve review feedback before its remediation is published.
- Never spin: do not re-dispatch unchanged feedback or failures without new evidence, and stop on inherited stop gates or non-progress.
- Never return `clean` without the final complete same-head clean resnapshot.

## Output Style

Report the verified PR, mode, result state, final head OID, final feedback and required-CI snapshot, waits, and any blocker. Include whether remediation changed local state, whether publication occurred, and whether the description was updated.
