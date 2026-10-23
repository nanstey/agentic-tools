# PR Merge

## Core Contract

Merge one open PR by squash, using the PR title followed by ` (#<pr-number>)` as the commit subject and an empty commit body. Load [`gates.md`](gates.md). Aim to merge: when a gate is unmet, run the lifecycle phase that satisfies it (`/pr ci`, `/pr review fix`, `/pr comments`, `/pr ready`; see [`lifecycle.md`](lifecycle.md)) and re-check, then merge. Pending required checks are waited on within `/pr monitor` semantics, not treated as failures. Human approvals, merge queues, and release policy are enforced by GitHub; a self-authored approval is never fabricated.

`force` merges even when soft gates in `gates.md` remain unmet (failing or pending CI, missing review, unresolved threads, draft, missing approval). Make one attempt to satisfy each gate, then merge anyway and report every overridden gate. If GitHub rejects the merge for branch protection and the viewer has admin permission, retry the same full merge command, passing the subject as a single argument from a variable (never interpolating the PR title into shell text) (`gh pr merge <number> --squash --subject "<title> (#<number>)" --body "" --admin`); without permission, report the hard stop. Without `force`, block only when a gate's work cannot proceed.

Default tool is `gh`. After a confirmed merge, a linked Orca-managed worktree is removed; the primary checkout is instead synced to the default branch and its terminal starts a new agent session. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL or number when supplied; otherwise the current branch.
2. Current outcome/check/review evidence, trusted policy, retained findings, and the invoking action's round state; no reset within that invocation or new review loop is authorized here.

## Workflow

1. Invoke `/pr info` to resolve one open PR and record number/title/draft state and authoritative base/head. Stop on its no-PR, multiple-PR, branch-mismatch, closed/merged, or other gate, including GitHub native-stack membership.
2. Check current outcome/quality/security/check evidence, or a `clean` docs-only evidence entry, under `gates.md`. Run any missing phase now rather than blocking. If draft, invoke `/pr ready` (with `force` when given); do not call raw `gh pr ready` or convert merely to start jobs.
3. Discover expected required checks/dependencies via `ci.md` and match current-head results. Failing, cancelled, timed-out, or action-required checks go to `/pr ci`; queued, pending, or in-progress checks are waited on; missing expected checks are investigated. Anything still unmet blocks, except under `force`: record each unmet CI gate as overridden and continue. For zero observed jobs use the verified-policy rule below.
4. Snapshot unresolved review threads and unresolved verified requests; run `/pr comments` or `/pr review fix` for them, and anything left blocks unless `force`. Verify actual required human approval/review jobs and merge-queue/release prerequisites from trusted policy and GitHub state, with evidence valid for the current base/head/policy, not a stale or self-authored approval. Use `--admin` only under `force`; if a required queue only schedules the merge, report pending rather than confirmed merged.
5. Re-run `/pr info` and require unchanged base/head and trusted policy; either revision changing invalidates snapshots and prior readiness/approval evidence.
6. Squash-merge with the PR title followed by ` (#<pr-number>)` as the commit subject and an empty body, following the subject rules below.
7. Confirm the PR is merged and report the merge result. A successful command that only queues or schedules a merge is not confirmation.
8. As the final step, classify the current checkout and run exactly one post-merge path. Never run either path after a failed, dry-run, or skipped merge, including a PR that was already merged when this workflow started.
   - **Primary checkout** (`git rev-parse --path-format=absolute --git-dir` equals `git rev-parse --path-format=absolute --git-common-dir`): follow the primary checkout notes below. Never remove it.
   - **Linked worktree**: automatically detect and remove the current Orca-managed worktree using the Orca cleanup notes below. Invoking `pr-merge` preauthorizes this removal once its conditions pass: do not ask for confirmation, offer cleanup, or defer it because it is destructive or ends the session. Skip cleanup silently outside Orca.

Stop as blocked when work for a gate cannot proceed without `force`, GitHub rejects the merge with no permitted override, or the PR head moves during the workflow (re-run the affected phases once, then merge).

## GitHub Implementation Notes

- Mark ready only through [`ready.md`](ready.md), after its outcome/CI/quality/security gates; no missing-job exception.
- Required checks: compare `gh pr checks <number> --required` with policy-expected jobs/dependencies under `ci.md`. Terminal skipped/neutral jobs require trusted-policy applicability evidence; terminal alone is insufficient.
- Zero observed jobs: use explicit `not applicable` only when actual trusted policy, applicable branch rules/rulesets, workflows, and external-check obligations verify no checks expected. Empty status rollups/run lists or a missing workflow directory alone do not prove that. Missing permissions, unknown expectations, pagination, API/auth/rate-limit errors, or missing required evidence stop blocked, never auto-pass.
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
4. Finish all reporting and any other commands before removal. Tell the user that the PR was merged and the current Orca worktree will now be removed. **This destroys the current worktree and ends its session; that is not grounds to refuse or defer.**
5. Run exactly `ORCA worktree rm --worktree active --force --json`, substituting only the resolved executable (the default form is `orca worktree rm --worktree active --force --json`). Run it without a confirmation prompt. This must be the final command: do not append verification, reporting commands, or other follow-up work.

## Safety Rules

- Never merge an ambiguous, closed, already merged, or branch-mismatched PR; `force` does not change this.
- Fix failing CI, thread feedback, and missing review only through their `/pr` phase actions, never inline here.
- Never edit the PR title or description.
- Never merge with a method other than squash, or with a non-empty commit body.
- Never explicitly delete the head branch, force-push, or change local git state except through the final post-merge path above.
- Never remove a worktree unless this workflow successfully merged the verified PR, confirmed its merged state, and detected the current cwd as a linked Orca-managed worktree. Never remove the primary checkout.
- When the confirmed-merge and Orca-current-worktree conditions pass, run the required removal without asking, offering, refusing, or deferring it because it is irreversible or session-ending.
- Never record pending, queued, in-progress, missing expected, or stale-base/head CI as passing; under `force` record it as overridden.
- Never reset the invoking action's state or fabricate human approval. Without `force`, do not waive unresolved verified requests by severity or cost.

## Output Style

Report the PR, overridden gates (under `force`), draft conversion, authoritative base/head/policy and outcome/review/expected-CI evidence, request/thread and human/queue gate snapshot, invoking action's round state, head merged and commit subject, post-merge path (worktree removed, primary synced/new session sent, or skipped), and any blocker.
