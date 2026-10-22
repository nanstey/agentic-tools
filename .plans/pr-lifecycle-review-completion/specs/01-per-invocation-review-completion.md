# Slice 1: Per-invocation review completion

## Objective

Make bare `/pr` complete review and monitoring before reporting, or return the documented blocked form. Scope each remediating action's three-round review/fix limit to its invocation.

## Implementation

- [x] Define the per-invocation round-state contract, blocked report form, and lifecycle completion gate in `skills/dev/pr/references/gates.md`.
- [x] Update bare `/pr`, lifecycle, review, and monitor documentation so a missing packet starts review, dispatch unavailability has the exact blocked result, and lifecycle completion requires final-head review plus monitor result.
- [x] Reword directly coupled PR remediation references to inherit only the invoking action's state and prohibit resets only within an invocation.
- [x] Reconcile `review-code`, `idea-to-pr`, `build`, and the shared packet contract so handoff to `/pr` passes packet/findings/evidence rather than cross-invocation round state.
- [x] Update this plan README's slice status and decision log after implementation.

## Static read-through traces

These are documentation read-through traces, not executed behavior.

- [x] Static trace: bare `/pr` has green CI but no matching packet; lifecycle starts `/pr review <PR> fix` in the same run and cannot report before monitor returns.
- [x] Static trace: review-code dispatch is unavailable; bare `/pr` returns exactly `blocked: needs a coordinator with subagent dispatch` without a next-command offer.
- [x] Static trace: `/pr review <target> fix` runs twice; each invocation starts at round 1 and permits at most three reviews and two fix heads.
- [x] Static trace: monitor remediates a changed head; it uses monitor's own invocation-scoped state and does not reset during polling cycles.
- [x] Static trace: `mode: once` returns `pending` for a head different from the matching clean packet; lifecycle starts review for that head, then monitors again, or returns the blocked form.

## Risk Controls

- Keep round arithmetic unchanged: initial review is round 1 and reserve a later review before publishing each fix head.
- Retain packet freshness, finding deduplication, and no-progress stops across invocations.
- Make no unrelated changes and preserve report/comment behavior outside the PR action workflow.

## Out of Scope

- Changing review depth, reviewer roles, packet freshness criteria, or readiness/merge authority.
- Altering the three-round semantics for workflows not directly coupled to the PR action handoff.
