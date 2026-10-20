
# PR

## Core Contract

Prepare the current branch for an open pull request, establish current outcome/required-CI evidence, and run bounded quality/security review with authorized fixes on your own PR. Then invoke `/pr monitor` with `mode: once`; monitor owns subsequent PR health and update work. Load [`gates.md`](gates.md) and pass its review packet, retained findings, and single three-round budget through every delegate.

With `auto-merge`, invoke `/pr monitor` with `mode: monitor` instead, and when it returns `clean`, invoke `/pr merge` for the same PR. Monitor may mark a draft ready only through `/pr ready` after all current prerequisite evidence is complete, then re-observes it. Human approval, required human-review jobs, queue and release policy remain later gates. This workflow never merges directly or grants its own approval.

Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch or PR URL/number.
2. Optional setup steps to skip (`review` skips executing self-review, not the readiness evidence requirement).
3. Optional `auto-merge` flag.
4. Acceptance criteria, observed outcome/validator evidence, trusted policy, matching review packet, and inherited round state when available.

## Workflow

1. Run `/git changes` first to resolve the comparison scope and record the exact base and head refs. When an existing PR is found, use `/pr info` for its base/head and recover the inherited packet/round state before any remediation commit; do not treat resumed work as a new allowance.
2. If `/git changes` reports uncommitted work:
   - on `main` or `develop`, create a branch with `/git branch`, then `/git commit` the work;
   - otherwise, `/git commit` the work.
3. Invoke `/pr info` to resolve and verify an existing PR.
4. If no PR exists, invoke `/pr create` (never raw `gh pr create`, including `--fill`), then use its resulting PR as the target. `/pr create` must run `/pr description`; confirm the body has the structured sections (`## Summary`, `## Changes`, `## Testing`) and the PR is a draft. If not, run `/pr description` now. Stop on any other `/pr info` gate.
5. Establish the authoritative base/head/policy and recover or initialize the caller-owned review state. Observe acceptance outcomes through separate validators and discover expected required CI/dependencies using `ci.md`. Do not advance quality/security lifecycle gates until outcome and independent required CI pass. Green CI or PR prose alone does not prove the outcome; zero observed jobs is not a pass.
6. Reuse an exact matching complete quality/security packet. Otherwise invoke `/pr review <PR> fix` on your own verified PR, with the inherited state and authorization; it reviews and narrowly fixes verified requests within the shared three-round limit, validates, publishes, and reviews the fix delta/affected paths at the new head. On another author's PR use report-only review, never automatic fixes. If `review` is skipped without matching evidence, report missing coverage rather than waive the gate. Run the review/fix cycle automatically: after each fix head is published and revalidated, start the next review round without waiting for user input or reporting a partial result. Stop only at convergence (`clean`) or a `blocked` stop condition in `gates.md`. Unresolved verified requests, material gaps, exhausted/no-progress work, failed validation/review/push, or unexpected state stop `blocked`; nits and unchanged existing issues are nonblocking.
7. Complete automated-review-dependent required CI after its prerequisites, then invoke `/pr monitor` for the same PR (a draft PR that passes the review cycle with all readiness prerequisites complete is marked ready through `/pr ready` by default, never merely to start checks) with the current packet/evidence/round state (re-resolve after any push): `mode: once` by default, `mode: monitor` with `auto-merge`. Monitor requests only missing/invalidated coverage, not a duplicate full review.
8. With `auto-merge`, invoke `/pr merge` only after monitor returns `clean` and current evidence has no unresolved verified requests or material gaps. An inherited blocker or later merge gate stops merging regardless of finding severity.
9. Report setup, review and engine outcomes, and merge outcome only when `auto-merge` was requested.

Stop as blocked when setup fails, a setup delegate reaches its stop gate, or the branch enters an unexpected state.

## Safety Rules

- Never continue from uncommitted work on `main` or `develop` without first creating a branch and committing it.
- Never continue past a failed setup step or its stop gate; report it as blocked instead.
- Never proceed when unexpected working-tree changes appear during setup.
- Never post review comments or approve from the lifecycle; automatic remediation is `fix` mode on your own PR only under ownership/branch/clean-tree/current-head authorization checks.
- Never pause between review/fix rounds to ask whether to continue; continuing within the budget is the default.
- Never reset the shared review budget, omit fix-head review, or treat a skipped review, an unapplied request, or missing outcome/check evidence as a readiness pass.
- Never create a PR with raw `gh pr create` or reuse a commit message as the body; always go through `/pr create` and its `/pr description` step.
- Never perform PR health or update work directly; invoke `/pr monitor`.
- Never merge without `auto-merge`, and never merge directly; invoke `/pr merge` only after a `clean` `/pr monitor` result.

## Output Style

Report comparison base/head/policy; branch/commit outcomes; PR; outcome and expected-CI evidence; packet verdict, retained/request/nit/existing IDs, rounds consumed, fixes/pushes or skipped coverage; monitor's final head/result/blocker; and, only with `auto-merge`, merge result or gate that stopped it.
