---
name: pr-merge
description: Marks a verified PR ready for review and squash-merges it when required CI passes and no review thread is unresolved. Use when a PR should be merged as-is, with no remediation of CI failures or review feedback.
user-invocable: true
disable-model-invocation: false
---

# PR Merge

## Core Contract

Merge one verified open PR by squash, using the PR title as the commit subject and an empty commit body. Convert a draft PR to ready-for-review first, then gate on required CI and unresolved review threads: any failing or non-terminal required check, or any unresolved thread, stops the skill. This skill never remediates; `pr-ci` and `pr-comments` own that work and are not invoked here.

Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL or number when supplied; otherwise the current branch.

## Workflow

1. Invoke `pr-info` to resolve and verify one open PR and record its `number`, `title`, `isDraft`, and `headRefOid`. Stop on its no-PR, multiple-PR, branch-mismatch, closed, merged, or other stop gate. Stop and ask if `pr-info` flags the PR as a layer of a GitHub native stack.
2. If `isDraft` is true, mark the PR ready for review.
3. Snapshot required CI for the current head. Stop if any required check is failing, cancelled, timed out, action-required, queued, pending, or in progress.
4. Snapshot unresolved review threads. Stop if any thread is unresolved.
5. Re-run `pr-info` and stop if `headRefOid` changed since step 1; the snapshots no longer describe the head being merged.
6. Squash-merge with the PR title as the commit subject and an empty body.
7. Report the merge result.

Stop and ask when a gate blocks, GitHub rejects the merge, or the PR head moves during the workflow.

## GitHub Implementation Notes

- Mark ready: `gh pr ready <number>`.
- Required checks: `gh pr checks <number> --required`. Only terminal, non-failing states pass the gate.
- Unresolved threads: `gh api graphql -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}' -F owner=<owner> -F repo=<repo> -F number=<number>` and count nodes where `isResolved` is false. Stop as blocked if the result is paginated beyond 100 threads or the query fails.
- Merge: `gh pr merge <number> --squash --subject "<title>" --body ""`. Pass the title verbatim from `pr-info`; do not rewrite it.
- Treat authentication, rate-limit, API, or incomplete-data failures as blockers; never infer a passing gate from missing data.

## Safety Rules

- Never merge an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never fix, retry, or rerun failing CI; stop and report it.
- Never reply to, resolve, or dismiss review threads; stop and report them.
- Never edit the PR title or description.
- Never merge with a method other than squash, or with a non-empty commit body.
- Never delete the head branch, force-push, or change local git state.
- Never treat pending, queued, in-progress, or stale-head CI as passing.

## Output Style

Report the verified PR, whether it was converted from draft, the required-CI and unresolved-thread snapshot, the head OID merged, the merge commit subject, and any blocker.
