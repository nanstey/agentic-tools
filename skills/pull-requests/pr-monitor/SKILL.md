---
name: pr-monitor
description: Monitors one verified PR until its current head is clean and review-ready. Use when a PR needs active supervision through CI and review completion.
user-invocable: true
disable-model-invocation: false
---

# PR Monitor

## Core Contract

Monitor one verified open PR until a stable clean snapshot proves all of the following for the same current head OID:

- no unresolved review threads remain; and
- every required CI check for that head is terminal and non-failing.

This is an orchestration skill. Delegate remediation to `pr-info`, `pr-comments`, `pr-ci`, `pr-rebase` (or its `gh-stack` handoff), and `pr-description`; do not reproduce their investigation, editing, validation, rebase, or thread-resolution internals. Preserve every delegate's safety gate and stop whenever a delegate stops or asks for a decision.

Pending, queued, or in-progress required checks are not clean. Wait and resnapshot rather than declaring success. Default polling interval is 60 seconds; use a user-supplied interval instead.

## Required Inputs

1. PR URL or number when supplied; otherwise the current branch.
2. Optional polling interval (default: 60 seconds).
3. Any explicit scope or stop condition from the user.

## Workflow

1. Invoke `pr-info` to resolve and verify one open PR, its current branch, and `headRefOid`. Stop on its no-PR, multiple-PR, branch-mismatch, closed, merged, or other stop gate.
2. Take a snapshot keyed to that `headRefOid`:
   - delegate unresolved-thread discovery and any required handling to `pr-comments`;
   - inspect required checks for that PR head as described in GitHub Implementation Notes; and
   - record the head OID, unresolved-thread state, and each required check's terminal/failure state.
3. If the snapshot finds actionable review feedback, invoke `pr-comments` with push deferred. Let it triage, make minimal local fixes, validate, and commit when appropriate. Do not reply to or resolve threads until the branch state that addresses them is pushed.
4. If the snapshot finds a completed failing required check, invoke `pr-ci` with push deferred. Let it investigate, classify, make minimal local fixes, validate, and commit when appropriate. Do not re-run or retry a failure without the evidence and safety decisions required by `pr-ci`.
5. Batch all local remediation before publishing. If changes need publishing, invoke `pr-rebase` exactly once after the batch; when it identifies a native stack, use its required `gh-stack` handoff instead. Do not create intermediate pushes. If rebase, stack synchronization, validation, or publication stops or fails, stop monitoring.
6. Invoke `pr-description` only when the published branch changes may have made the title or body drift. Do not refresh a description merely because another polling cycle occurred.
7. After the relevant branch state is pushed, delegate final thread replies and resolutions to `pr-comments`. Keep any blocked or non-actionable thread unresolved as that skill requires.
8. Resnapshot with `pr-info`. If the head OID changed during remediation, discard the previous snapshot and restart at step 2 for the new head.
9. When unresolved threads are absent and all required checks for the snapshot head are terminal and non-failing, immediately take one final `pr-info` and required-check/thread resnapshot. Exit clean only if it reports the identical head OID and the same clean conditions.
10. Otherwise, if required checks are pending, queued, or in progress and there is no actionable work, wait for the configured interval and return to step 2. Never poll more frequently than that interval or re-dispatch unchanged feedback or failures without new evidence.

## GitHub Implementation Notes

- Use `pr-info` as the authoritative source for the PR number, repository, and `headRefOid`; do not infer the head from a local ref.
- For each CI snapshot, query required checks with `gh pr checks <number> --required`. Treat that output as valid only after a surrounding `pr-info` resnapshot confirms the same `headRefOid`; otherwise discard it and resnapshot the new head.
- Classify a required check as clean only when it is terminal and non-failing. `pending`, `queued`, `in_progress`, and equivalent waiting states require polling. Failed, cancelled, timed-out, action-required, or otherwise failing terminal states require `pr-ci`, not success.
- If GitHub returns pagination, authentication, rate-limit, or API errors, stop and report the exact external blocker. Never infer a clean state from incomplete check or thread data.
- Sleep with `sleep <interval-seconds>` between pending-state snapshots. Do not use a watch mode that hides the head OID or bypasses the same-head resnapshot requirement.

## Safety Rules

- Never monitor an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never treat pending CI as passing CI, or checks from a prior head as checks for the current head.
- Never duplicate the remediation internals or override the stop-and-ask gates of delegated PR skills.
- Never push partial remediation, force-push outside `pr-rebase` or its stack handoff, or resolve/reply to review threads before their branch state is final and pushed.
- Never spin: wait at least the configured interval for pending checks, avoid re-dispatching an unchanged issue, and stop on inherited stop gates, ambiguous or risky feedback, external blockers, validation failure, unexpected working-tree changes, authentication/rate-limit failure, or non-progress.
- Never claim success without the final same-head clean resnapshot.

## Output Style

Report the verified PR and final head OID; the final required-check and unresolved-thread snapshot; work delegated and any single publication; the polling interval and number of waits; and either clean completion or the precise stop gate/blocker.
