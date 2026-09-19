---
name: pr-merge
description: Marks a verified PR ready for review and squash-merges it when required CI passes and no review thread is unresolved. Use when a PR should be merged as-is, with no remediation of CI failures or review feedback.
user-invocable: true
disable-model-invocation: false
---

# PR Merge

## Core Contract

Merge one verified open PR by squash, using the PR title followed by ` (#<pr-number>)` as the commit subject and an empty commit body. Convert a draft PR to ready-for-review first, then gate on required CI and unresolved review threads: any failing or non-terminal required check, or any unresolved thread, stops the skill. This skill never remediates; `pr-ci` and `pr-comments` own that work and are not invoked here.

Default tool is `gh`; use the resolved Orca CLI for final cleanup only when the current cwd is an Orca-managed worktree. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL or number when supplied; otherwise the current branch.

## Workflow

1. Invoke `pr-info` to resolve and verify one open PR and record its `number`, `title`, `isDraft`, and `headRefOid`. Stop on its no-PR, multiple-PR, branch-mismatch, closed, merged, or other stop gate. Stop and ask if `pr-info` flags the PR as a layer of a GitHub native stack.
2. If `isDraft` is true, mark the PR ready for review.
3. Snapshot required CI for the current head. Stop if any required check is failing, cancelled, timed out, action-required, queued, pending, or in progress.
4. Snapshot unresolved review threads. Stop if any thread is unresolved.
5. Re-run `pr-info` and stop if `headRefOid` changed since step 1; the snapshots no longer describe the head being merged.
6. Squash-merge with the PR title followed by ` (#<pr-number>)` as the commit subject and an empty body, following the subject rules below.
7. Confirm the PR is merged and report the merge result. A successful command that only queues or schedules a merge is not confirmation.
8. As the final step, automatically detect and remove the current Orca-managed worktree using the cleanup notes below. Invoking `pr-merge` preauthorizes this removal once its conditions pass: do not ask for confirmation, offer cleanup, or defer it because it is destructive or ends the session. Skip cleanup silently outside Orca. Never run cleanup after a failed, dry-run, or skipped merge, including a PR that was already merged when this workflow started.

Stop and ask when a gate blocks, GitHub rejects the merge, or the PR head moves during the workflow.

## GitHub Implementation Notes

- Mark ready: `gh pr ready <number>`.
- Required checks: `gh pr checks <number> --required`. Only terminal, non-failing states pass the gate.
- Unresolved threads: `gh api graphql -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}' -F owner=<owner> -F repo=<repo> -F number=<number>` and count nodes where `isResolved` is false. Stop as blocked if the result is paginated beyond 100 threads or the query fails.
- Merge: `gh pr merge <number> --squash --subject "<title> (#<number>)" --body ""`. Use the verified PR number from `pr-info` or `gh pr view <number> --json number`. Preserve the title text and append ` (#<number>)`; if the title already ends with that exact suffix, keep it only once. Whenever overriding the merge commit subject, require this suffix at the end of the subject line. This rule affects only the subject; keep the commit body empty.
- Example subject: `fix(pr-merge): clean up Orca worktree after confirmed merge (#66)`.
- When using GitHub's default squash-merge subject without overriding it, GitHub automatically appends `(#N)`; no additional suffix is needed on that path.
- Confirm after a successful merge command: `gh pr view <number> --json state,mergedAt,url`. Require `state` to be `MERGED` and `mergedAt` to be non-null before cleanup; otherwise report the pending or unconfirmed result and stop without cleanup.
- Treat authentication, rate-limit, API, or incomplete-data failures as blockers; never infer a passing gate from missing data.

## Orca Cleanup Notes

Only enter this step after this workflow's merge succeeded and was confirmed above. A `pr-merge` invocation authorizes the required removal; do not request further permission or defer it because it terminates the session.

1. Resolve the executable once, following the `orca-cli` skill stub: use `ORCA_CLI_COMMAND` when set; otherwise `orca-dev` when the session exposes `ORCA_DEV_REPO_ROOT`; otherwise `orca-ide` on Linux outside an Orca-managed terminal; otherwise `orca`. On Linux without a reliable managed-terminal hint, use `orca-ide` to avoid launching the GNOME screen reader. Below, `ORCA` is a placeholder for this executable, not a literal command or a shell variable; substitute the resolved executable, quoting its path if needed.
2. Check that the selected executable resolves (for example, `command -v` in a POSIX shell). If unavailable, skip cleanup silently. Do not fall through to a different executable. Load its version-matched guide with `ORCA skills get orca-cli` before running Orca commands.
3. From the unchanged current cwd, run `ORCA worktree current --json`. Require a successful exit and valid JSON with `ok: true` identifying the enclosing worktree for that cwd. Missing, failed, malformed, or non-ok results mean skip cleanup silently; environment hints alone never authorize removal. Do not select a different worktree or change directories.
4. Finish all reporting and any other commands before removal. Tell the user that the PR was merged and the current Orca worktree will now be removed. **This destroys the current worktree and ends its session; that is not grounds to ask, refuse, or defer.**
5. Run exactly `ORCA worktree rm --worktree active --force --json`, substituting only the resolved executable (the default form is `orca worktree rm --worktree active --force --json`). Run it without a confirmation prompt. This must be the final command: do not append verification, reporting commands, or other follow-up work.

## Safety Rules

- Never merge an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never fix, retry, or rerun failing CI; stop and report it.
- Never reply to, resolve, or dismiss review threads; stop and report them.
- Never edit the PR title or description.
- Never merge with a method other than squash, or with a non-empty commit body.
- Never explicitly delete the head branch, force-push, or change local git state except through the final Orca worktree cleanup above.
- Never remove a worktree unless this workflow successfully merged the verified PR, confirmed its merged state, and detected the current cwd as an Orca-managed worktree.
- When the confirmed-merge and Orca-current-worktree conditions pass, run the required removal without asking, offering, refusing, or deferring it because it is irreversible or session-ending.
- Never treat pending, queued, in-progress, or stale-head CI as passing.

## Output Style

Report the verified PR, whether it was converted from draft, the required-CI and unresolved-thread snapshot, the head OID merged, the merge commit subject, and any blocker.
