# PR Ready

## Core Contract

Convert one open draft PR to ready-for-review once current outcome, expected required CI, quality and security evidence, or a `clean` docs-only evidence entry, passes [`gates.md`](gates.md). When evidence is missing, run the missing phase from [`lifecycle.md`](lifecycle.md) first (review, CI fix, threads), then convert. Never self-grant approval or merge. `force` converts even with soft gates unmet, recording each override. A clean source packet or green observed jobs alone is insufficient without `force`. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Default tool is `gh`.

## Required Inputs

1. PR URL/number; otherwise current branch.
2. Current acceptance/outcome evidence, trusted policy and expected-check inventory, quality/security packet or docs-only evidence entry, retained findings, and the invoking action's round state. Missing material evidence is blocked, not permission to launch another review loop.

## Workflow

1. Invoke `/pr info`; verify one open PR and record number, draft state, authoritative base/head. Stop on its gates.
2. Verify current policy and evidence identities. Reuse a packet or docs-only evidence entry only for the exact matching base/head/policy/scope/check coverage/evidence snapshot; stale or incomplete coverage triggers the missing review phase now; block only if that cannot run and `force` is absent. Either base or head changing invalidates prior readiness/approval evidence.
3. Require observed acceptance outcomes, then policy-expected independent required CI, complete quality review and security coverage, or a `clean` trusted-base docs-only evidence entry under `gates.md`, then automated-review-dependent required CI. Discover expectations/dependencies under `ci.md`; never infer pass from no observed checks. Explicit `not applicable` needs trusted-policy proof that no checks are expected. Missing readiness-required jobs/policy, failing/nonterminal jobs due at readiness, unresolved verified requests, failed reviewers, or material gaps block conversion unless `force`, which records them as overridden. Later human/queue/release jobs remain due at their own gates, not falsely passed or demanded before their prerequisites. Nits and baseline-proven unchanged existing issues do not block absent explicit applicable policy.
4. Ready-only required jobs need a supported draft/manual trigger or explicitly authorized configuration change; otherwise stop using the `gates.md` blocked form with that requirement as the unblocking condition (`force` records it as overridden and converts). Never mark ready merely to start checks or treat unrun checks as passed. Human approval/jobs, merge queues, and release flag/rollback policy remain later gates; they are not waived by readiness.
5. Snapshot unresolved review threads (see `merge.md` implementation notes); stop blocked if any remain, except under `force`, which records them as overridden. Re-run `/pr info` and require unchanged base/head/policy and current evidence.
6. If already ready, report that state without mutation, but claim gate success only if the preceding evidence is complete. Otherwise run `gh pr ready <number>`, re-read, and require `isDraft` false and unchanged base/head.
7. Return current evidence/state to the caller. A follow-up `/pr monitor` must re-observe the ready snapshot and any new jobs; conversion is neither human approval nor merge authorization.

## Safety Rules

- Never convert an ambiguous, closed, merged, or branch-mismatched PR.
- Without `force`, never convert with unresolved verified requests/threads, stale/missing material evidence, failing/nonterminal required CI, or an exhausted round limit that leaves required review incomplete.
- This action itself only converts; remediation runs through the phase actions that own it. Never edit title/description or reset the invoking action's state here.
- Never convert to draft here (the draft-before-changes rule in `gates.md` owns that) or bypass human/queue/release gates.
- Authentication, pagination, rate-limit, API, and incomplete-data failures are blockers.

## Output Style

Report PR, converted/already-ready/blocked, authoritative base/head/policy, observed outcome and expected-CI evidence, quality/security packet or docs-only evidence entry and round state, thread/request/gap snapshot, and, when blocked, the `gates.md` blocked form with its unblocking condition. State that follow-up monitor observation is required; never claim approval or merge permission.
