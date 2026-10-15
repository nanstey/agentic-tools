# PR Merge

## Core Contract

Merge one verified open PR by squash, using the PR title followed by ` (#<pr-number>)` as the commit subject and an empty commit body. Convert a draft PR to ready-for-review first, then gate on required CI and unresolved review threads: any failing or non-terminal required check, or any unresolved thread, stops the skill. This skill never remediates; `/pr ci` and `/pr comments` own that work and are not invoked here.

Default tool is `gh`. After a confirmed merge, a linked Orca-managed worktree is removed; the primary checkout is instead synced to the default branch and its terminal starts a new agent session. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL or number when supplied; otherwise the current branch.

## Workflow

1. Invoke `/pr info` to resolve and verify one open PR and record its `number`, `title`, `isDraft`, and `headRefOid`. Stop on its no-PR, multiple-PR, branch-mismatch, closed, merged, or other stop gate. Stop and ask if `/pr info` flags the PR as a layer of a GitHub native stack.
2. If `isDraft` is true, mark the PR ready for review.
3. Snapshot required CI for the current head. Stop if any required check is failing, cancelled, timed out, action-required, queued, pending, or in progress.
4. Snapshot unresolved review threads. Stop if any thread is unresolved.
5. Re-run `/pr info` and stop if `headRefOid` changed since step 1; the snapshots no longer describe the head being merged.
6. Squash-merge with the PR title followed by ` (#<pr-number>)` as the commit subject and an empty body, following the subject rules below.
7. Confirm the PR is merged and report the merge result. A successful command that only queues or schedules a merge is not confirmation.
8. As the final step, classify the current checkout and run exactly one post-merge path. Never run either path after a failed, dry-run, or skipped merge, including a PR that was already merged when this workflow started.
   - **Primary checkout** (`git rev-parse --path-format=absolute --git-dir` equals `git rev-parse --path-format=absolute --git-common-dir`): follow the primary checkout notes below. Never remove it.
   - **Linked worktree**: automatically detect and remove the current Orca-managed worktree using the Orca cleanup notes below. Invoking `pr-merge` preauthorizes this removal once its conditions pass: do not ask for confirmation, offer cleanup, or defer it because it is destructive or ends the session. Skip cleanup silently outside Orca.

Stop and ask when a gate blocks, GitHub rejects the merge, or the PR head moves during the workflow.

## GitHub Implementation Notes

- Mark ready: `gh pr ready <number>`.
- Required checks: `gh pr checks <number> --required`. Only terminal, non-failing states pass the gate.
- Unresolved threads: `gh api graphql -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}' -F owner=<owner> -F repo=<repo> -F number=<number>` and count nodes where `isResolved` is false. Stop as blocked if the result is paginated beyond 100 threads or the query fails.
- Merge: `gh pr merge <number> --squash --subject "<title> (#<number>)" --body ""`. Use the verified PR number from `/pr info` or `gh pr view <number> --json number`. Preserve the title text and append ` (#<number>)`; if the title already ends with that exact suffix, keep it only once. Whenever overriding the merge commit subject, require this suffix at the end of the subject line. This rule affects only the subject; keep the commit body empty.
- Example subject: `fix(pr-merge): clean up Orca worktree after confirmed merge (#66)`.
- When using GitHub's default squash-merge subject without overriding it, GitHub automatically appends `(#N)`; no additional suffix is needed on that path.
- Confirm after a successful merge command: `gh pr view <number> --json state,mergedAt,url`. Require `state` to be `MERGED` and `mergedAt` to be non-null before cleanup; otherwise report the pending or unconfirmed result and stop without cleanup.
- Treat authentication, rate-limit, API, or incomplete-data failures as blockers; never infer a passing gate from missing data.

## Primary Checkout Notes

Only enter this step after this workflow's merge succeeded and was confirmed above, and only from the primary checkout.

1. Require a clean working tree (`git status --porcelain` is empty). Otherwise stop and report; never stash, commit, or discard to proceed.
2. Run `git comp` to check out the default branch and pull the latest changes. If the alias is not defined, run `git checkout <default-branch> && git pull --ff-only` instead. Stop and report on any checkout or pull failure, and do not start a new session.
3. Report the merge, the synced branch, and its new `HEAD` before starting the new session.
4. Start a new agent session in the current terminal; never open a new terminal or launch a second agent. Send this harness's new-session command (`/clear` in Claude Code, `/new` in Codex or Pi) to the current terminal. Inside Orca, resolve the executable as in the Orca cleanup notes and run `ORCA terminal send --terminal "$ORCA_TERMINAL_HANDLE" --text "<new-session-command>" --enter --json`. Without Orca or `ORCA_TERMINAL_HANDLE`, tell the user to run that command. This must be the final command.

## Orca Cleanup Notes

Only enter this step after this workflow's merge succeeded and was confirmed above. A `pr-merge` invocation authorizes the required removal; do not request further permission or defer it because it terminates the session.

1. Resolve the executable once, following the `orca-cli` skill stub: use `ORCA_CLI_COMMAND` when set; otherwise `orca-dev` when the session exposes `ORCA_DEV_REPO_ROOT`; otherwise `orca-ide` on Linux outside an Orca-managed terminal; otherwise `orca`. On Linux without a reliable managed-terminal hint, use `orca-ide` to avoid launching the GNOME screen reader. Below, `ORCA` is a placeholder for this executable, not a literal command or a shell variable; substitute the resolved executable, quoting its path if needed.
2. Check that the selected executable resolves (for example, `command -v` in a POSIX shell). If unavailable, skip cleanup silently. Do not fall through to a different executable. Load its version-matched guide with `ORCA skills get orca-cli` before running Orca commands.
3. From the unchanged current cwd, run `ORCA worktree current --json`. Require a successful exit and valid JSON with `ok: true` identifying the enclosing worktree for that cwd, with `isMainWorktree` false; if it is true, follow the primary checkout notes instead. Missing, failed, malformed, or non-ok results mean skip cleanup silently; environment hints alone never authorize removal. Do not select a different worktree or change directories.
4. Finish all reporting and any other commands before removal. Tell the user that the PR was merged and the current Orca worktree will now be removed. **This destroys the current worktree and ends its session; that is not grounds to ask, refuse, or defer.**
5. Run exactly `ORCA worktree rm --worktree active --force --json`, substituting only the resolved executable (the default form is `orca worktree rm --worktree active --force --json`). Run it without a confirmation prompt. This must be the final command: do not append verification, reporting commands, or other follow-up work.

## Safety Rules

- Never merge an unverified, ambiguous, closed, merged, or branch-mismatched PR.
- Never fix, retry, or rerun failing CI; stop and report it.
- Never reply to, resolve, or dismiss review threads; stop and report them.
- Never edit the PR title or description.
- Never merge with a method other than squash, or with a non-empty commit body.
- Never explicitly delete the head branch, force-push, or change local git state except through the final post-merge path above.
- Never remove a worktree unless this workflow successfully merged the verified PR, confirmed its merged state, and detected the current cwd as a linked Orca-managed worktree. Never remove the primary checkout.
- When the confirmed-merge and Orca-current-worktree conditions pass, run the required removal without asking, offering, refusing, or deferring it because it is irreversible or session-ending.
- Never treat pending, queued, in-progress, or stale-head CI as passing.

## Output Style

Report the verified PR, whether it was converted from draft, the required-CI and unresolved-thread snapshot, the head OID merged, the merge commit subject, the post-merge path taken (worktree removed, primary checkout synced and new session sent, or skipped with reason), and any blocker.
