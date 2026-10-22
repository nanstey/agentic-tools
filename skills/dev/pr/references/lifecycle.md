
# PR

## Core Contract

Prepare the current branch for an open pull request, establish current outcome/required-CI evidence, and run bounded quality/security review with authorized fixes on your own PR. Then invoke `/pr monitor` with `mode: once`; monitor owns subsequent PR health and update work. Load [`gates.md`](gates.md) and pass its review packet and retained findings; each delegate invocation (`/pr review fix`, `/pr monitor`) owns its own three-round limit. This workflow may end only through the lifecycle completion gate in `gates.md`.

With `auto-merge`, invoke `/pr monitor` with `mode: monitor` instead, and when it returns `clean`, invoke `/pr merge` for the same PR. Monitor may mark a draft ready only through `/pr ready` after all current prerequisite evidence is complete, then re-observes it. Human approval, required human-review jobs, queue and release policy remain later gates. This workflow never merges directly or grants its own approval.

Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch or PR URL/number.
2. Optional setup steps to skip (`review` skips only otherwise redundant self-review; it never skips the required review gate).
3. Optional `auto-merge` flag.
4. Acceptance criteria, observed outcome/validator evidence, trusted policy, matching review packet, and retained findings when available.

## Workflow

1. Run `/git changes` first to resolve the comparison scope and record the exact base and head refs. When an existing PR is found, use `/pr info` for its base/head and recover the prior packet/findings before any remediation commit. Round limits are per invocation, not inherited.
2. If `/git changes` reports uncommitted work:
   - on `main` or `develop`, create a branch with `/git branch`, then `/git commit` the work;
   - otherwise, `/git commit` the work.
3. Invoke `/pr info` to resolve and verify an existing PR.
4. If no PR exists, invoke `/pr create` (never raw `gh pr create`, including `--fill`), then use its resulting PR as the target. `/pr create` must run `/pr description`; confirm the body has the structured sections (`## Summary`, `## Changes`, `## Testing`) and the PR is a draft. If not, run `/pr description` now. Stop on any other `/pr info` gate.
5. Establish the authoritative base/head/policy and recover the prior packet/findings. Observe acceptance outcomes through separate validators and discover expected required CI/dependencies using `ci.md`. Do not advance quality/security lifecycle gates until outcome and independent required CI pass. Passing this step is not an end state: continue to step 6 in the same run. Green CI or PR prose alone does not prove the outcome; zero observed jobs is not a pass.
6. Reuse an exact matching complete quality/security packet. Otherwise start `/pr review <PR> fix` now on your own verified PR; it owns its three-round limit, reviews and narrowly fixes verified requests, validates, publishes, and reviews the fix delta/affected paths at the new head. On another author's PR start report-only review, never automatic fixes. A `review` skip skips only otherwise redundant self-review; it never waives this gate, so a missing packet starts review in this run. If review-code dispatch is unavailable, return exactly `blocked: needs a coordinator with subagent dispatch`. Run the review/fix cycle automatically: after each fix head is published and revalidated, start the next review round without waiting for user input or reporting a partial result. Stop only at convergence (`clean`) or a `blocked` stop condition in `gates.md`. Unresolved verified requests, material gaps, exhausted/no-progress work, failed validation/review/push, or unexpected state stop `blocked`; nits and unchanged existing issues are nonblocking.
7. Complete automated-review-dependent required CI after its prerequisites, then always invoke `/pr monitor` for the same PR only after a matching `clean` packet (re-resolve after any push): `mode: once` by default, `mode: monitor` with `auto-merge`. Pass the packet and evidence, not round counters. Monitor requests only missing/invalidated coverage, not a duplicate full review, and the lifecycle cannot return before monitor returns its result. If monitor returns `clean`, or returns `pending` in `mode: once`, for a final head different from that packet's head, permit exactly one reconciliation: accept and reuse monitor's exact-match complete fresh packet for that head when it satisfies `gates.md` freshness; otherwise start the step-6 appropriate review for that head (`fix` only on an own PR; report-only for another author's PR). Then monitor the resulting matching clean head once. If that reconciliation monitor result still names a head different from its matching clean packet, return the `gates.md` blocked form for external head churn or no progress. If review or monitoring cannot proceed, return the `gates.md` blocked form; do not end with mismatched packet/head evidence.
8. When monitor passes (all readiness prerequisites complete on the current head) and the PR is still a draft, mark it ready through `/pr ready` by default, never merely to start checks. Human approval and merge remain separate gates.
9. With `auto-merge`, invoke `/pr merge` only after monitor returns `clean` and current evidence has no unresolved verified requests or material gaps. An inherited blocker or later merge gate stops merging regardless of finding severity.
10. Report the final packet verdict and head and monitor result under the lifecycle completion gate, or the blocked form; report merge outcome only when `auto-merge` was requested.

Stop as blocked when setup fails, a setup delegate reaches its stop gate, or the branch enters an unexpected state.

## Safety Rules

- Never continue from uncommitted work on `main` or `develop` without first creating a branch and committing it.
- Never continue past a failed setup step or its stop gate; report it as blocked instead.
- Never proceed when unexpected working-tree changes appear during setup.
- Never post review comments or approve from the lifecycle; automatic remediation is `fix` mode on your own PR only under ownership/branch/clean-tree/current-head authorization checks.
- Never pause between review/fix rounds to ask whether to continue; continuing within the budget is the default.
- Never reset or nest a review loop within an invocation, omit fix-head review, or treat a skipped review, an unapplied request, or missing outcome/check evidence as a readiness pass.
- Never end after setup or green CI without satisfying the lifecycle completion gate.
- Never offer, suggest, or ask for a next command (including `/pr review` or `/pr monitor`); start it or report blocked.
- Publish every change to the PR branch through `/pr push`, which runs the description check for the new head.
- Never create a PR with raw `gh pr create` or reuse a commit message as the body; always go through `/pr create` and its `/pr description` step.
- Never perform PR health or update work directly; invoke `/pr monitor`.
- Never merge without `auto-merge`, and never merge directly; invoke `/pr merge` only after a `clean` `/pr monitor` result.

## Output Style

Report comparison base/head/policy; branch/commit outcomes; PR; outcome and expected-CI evidence; final packet verdict/head, retained/request/nit/existing IDs, rounds consumed, fixes/pushes or skipped coverage; monitor's final head/result or the blocked form; and, only with `auto-merge`, merge result or gate that stopped it.
