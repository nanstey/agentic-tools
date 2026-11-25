# PR merge

Merge one open PR by squash. See [policy](_policy.md#required-checks) for check rules and [policy](_policy.md#squash-subject) for the subject.

## Inputs

- PR target, or the current branch.
- Active run id and current evidence; `force` is optional.

## Steps

1. Resolve with `pr snapshot [target]`. If it is a native stack member, return `blocked` with its PR URL; merge it in GitHub's web UI.
2. Run missing phases within the active run budget. Review and thread work uses `/pr review fix` and `/pr comments`. See the [lifecycle](00-lifecycle.md).
3. Discover expected checks with `pr checks inventory` and select the complete required list from trusted policy. Zero observed checks never pass; skipped/neutral checks need policy proof. Wait with `pr checks wait --run <id> --required <check...> --timeout 30m`; without force, pending checks return `pending` and do not merge. With force, take one snapshot and record pending checks as overridden.
4. Run `pr threads` and confirm review, approval, queue, and release gates against trusted policy. Re-snapshot with `pr snapshot [target]`; require unchanged base and head.
5. Merge with `pr merge [target] --run <id> --required <check...> [--force]`, passing the complete policy-selected required-check list. If trusted policy proves no checks are required, use `pr merge [target] --run <id> --no-required-checks --policy-proof <text> [--force]`; the reason is required and recorded in the run. The merge uses an empty commit body. Use `--force` only under the force policy. Under force, the merge script retries with `--admin` only when GitHub rejects for branch protection and the viewer has admin permission. A queued result is not a merge and does not run cleanup.
6. Merge records the run completion. Do not run `pr run end` after a merged result. After confirming `state: MERGED` and non-null `mergedAt`, follow exactly one post-merge path, with cleanup as the final command. Never run either path after a failed, queued, skipped, or previously completed merge.
   - **Primary checkout:** require a clean tree, then run `git comp` to check out and fast-forward the default branch. If unavailable, use `git checkout <default-branch> && git pull --ff-only`. Stop on failure. Report the merge, synced branch, and new `HEAD` before the final command. In the current terminal, start a new session with `/clear` in Claude Code or `/new` in Codex/Pi. In Orca, use `ORCA terminal send --terminal "$ORCA_TERMINAL_HANDLE" --text "<new-session-command>" --enter --json`; without Orca or the handle, tell the user the command. This must be the final command.
   - **Linked Orca worktree:**
     - `/pr merge` and `/pr automerge` preauthorize removal after verified merge; do not ask or defer.
     - Resolve Orca as `ORCA_CLI_COMMAND`, else `orca-dev` when `ORCA_DEV_REPO_ROOT` is set, else `orca-ide` on Linux or `orca` elsewhere. The cleanup script classifies Git primary vs linked.
     - Before cleanup, query `worktree current --json` from the unchanged cwd. Require valid JSON, `ok: true`, `isMainWorktree: false`, and a non-empty captured id.
     - `selector_not_found` means `skipped (outside Orca)`; an unavailable executable means `skipped (Orca unavailable)`; other failures are concrete cleanup failures.
     - Report the confirmed merge, captured worktree id, and that removal is starting and ends the session. Then run `pr cleanup [target] --run <id>` last.
     - Never remove a primary checkout, select another worktree, retry removal, or run follow-up commands.

## Output

Report PR, evidence and overridden gates, run id, merge status and subject, and cleanup result. Keep cleanup conditions and outcomes clear: `remove:<id>`, `primary`, `skipped (Orca unavailable)`, `skipped (outside Orca)`, or `cleanup failed: <reason>`. A cleanup failure is not skipped.
