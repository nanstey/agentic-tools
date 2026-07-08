---
name: green-ci
description: Iterates fix-and-verify cycles on the current branch until CI is green or a brake trips. Use when a branch has failing CI that should be driven to green without step-by-step prompting.
user-invocable: true
disable-model-invocation: false
---

# Green CI Loop

## Purpose

Drive the current branch's CI to green through repeated fix → verify cycles,
without a human prompting each attempt. This is a minimal reference loop: it
shows the full `LOOP.md` shape on a small, real orchestration.

## Trigger

Manual invocation on a branch with an open PR, or a CI-failure notification for
that branch.

## Goal & Termination

- **Goal (verifiable):** every required CI job on the branch's PR reports
  success (`pr-ci` confirms all checks green).
- **Stop on success:** goal met.
- **Stop on brake:** any brake in `## Brakes & Budget` trips.
- **Stop on escalation:** a condition in `## Escalation` is hit.

## Agents

- `worker` — applies the smallest correct fix for the diagnosed failure.
- `reviewer` — judges each fix against the failure and the diff before it is
  committed, so the actor is not its own judge.

## Skills

- `pr-ci` — diagnose failing jobs, identify root cause, and validate fixes.
- `commit` — group the fix into a clean commit and push so CI re-runs.

## Loop

1. **Observe** — run `pr-ci` to list failing jobs and extract the root-cause
   signal (logs, failing tests, the offending diff).
2. **Decide** — pick the single next fix; if the same failure recurs unchanged,
   change strategy rather than repeat the last attempt.
3. **Act** — delegate the fix to `worker`, scoped to that root cause.
4. **Verify** — have `reviewer` check the fix against the failure and diff, then
   run the relevant checks locally where possible.
5. **Commit & re-run** — `commit` the fix and push; wait for CI.
6. **Repeat** — if CI is green, stop (goal met); otherwise return to step 1.

## Brakes & Budget

- **Max iterations:** 3 fix→verify cycles.
- **No-progress detection:** stop if two consecutive cycles produce the same
  failure signal with no reduction in failing jobs.
- **Budget:** cap total tool/token spend per run; stop and escalate if exceeded.

## Escalation

Stop and hand back to a human with a concise summary (what failed, what was
tried, current state, suspected cause) when a brake trips, when a failure needs
a product/architecture decision, or when required access/credentials are
missing.

## Verification

Done is proven only by `pr-ci` reporting all required checks green — not by an
agent asserting completion. The `reviewer` gate on each cycle guards against
committing an unverified fix.
