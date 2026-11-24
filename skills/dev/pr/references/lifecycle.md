# PR Lifecycle

## Core Contract

Push the PR as close to merge as one run can. Detect where the PR is, run each unmet phase in order, and continue until it is ready (or merged, with `automerge`). The run does not stay to watch the PR afterwards: prflow tick follows up on CI failures, new feedback, and base changes. A run never stops to warn: it does the work, or reports the exact thing that cannot be done.

Load [`gates.md`](gates.md) for evidence, review depth, force, and the round limit. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

- `/pr`: phases 0–9, ending at merge-ready. Merge needs `/pr merge` or `automerge`.
- `/pr automerge [target]`: phases 0–9, then phase 10 (`/pr merge`), which waits for pending required checks. With `force`, `/pr merge force` records unmet gates as overridden instead of waiting or blocking.
- `force` on either: apply the `gates.md` force override to soft gates instead of blocking.

## Inputs

1. Current branch, or PR URL/number.
2. Optional `automerge` and `force`.
3. Optional skip words (`review` reuses an exact-matching packet and skips only redundant self-review; it never waives missing coverage).
4. Acceptance criteria, trusted policy, any matching packet or docs-only evidence entry, and retained findings.

## Phases

Each phase has an entry test. Run a phase only when its test shows it is unmet or invalidated by a new head. After any head change, re-snapshot and re-test later phases.

| # | Phase | Unmet when | Action |
| --- | --- | --- | --- |
| 0 | Resolve | Always run first | `/git changes` for scope and base/head. `/pr info` for an existing PR and its prior packet/findings. Uncommitted work on `main`/`develop`: `/git branch`, then `/git commit`. Otherwise `/git commit`. |
| 1 | Create | No PR exists | `/pr create` (never raw `gh pr create`). It opens a draft and runs `/pr description`. |
| 2 | Publish | Local commits are unpushed or the tree has validated changes | `/pr push` |
| 3 | Describe | Body is a placeholder, lacks `## Summary`/`## Changes`/`## Testing`, or is stale for this head; UI changed with no current screenshots | `/pr description` (owns `/pr screenshots`) |
| 4 | Sync | Behind base, conflicting, or a stack layer out of order | Stack member: `/pr stack`. Otherwise `/pr rebase`. After a parent merges: `/pr restack`. `/pr split` only when invoked explicitly. |
| 5 | CI | Outcome unobserved, or an expected required check failed or is missing | `/pr ci`: fix and publish. Do not wait for pending checks: continue to phase 6. prflow tick watches the PR and sends a `ci` brief once checks finish with a failure. Only `automerge` waits, in phase 10 (`/pr merge`). |
| 6 | Review | No exact-match complete packet or `clean` docs-only entry for this head | Own PR: `/pr review <PR> fix`. Other author's PR: `/pr review <PR> report` report-only. Review publication requires a mode-less explicit `/pr review` invocation. Depth follows `gates.md` review depth. |
| 7 | Threads | Unresolved review threads, or a reviewer whose feedback is addressed but who is not re-requested | `/pr comments` |
| 8 | Verify | Claims lack cited evidence in the body | `/pr verification fix` (own PR) |
| 9 | Ready | PR is draft and phases 1–8 pass | `/pr ready` |
| 10 | Merge | `automerge` | `/pr merge` (with `force` if given) |

Phase order matches the gate order in `gates.md`: outcome and independent CI before quality and security review, review-dependent CI after.

### Rules for the run

1. Run phases back-to-back. Never pause between phases or review/fix rounds to ask whether to continue.
2. Publish every change through `/pr push`, which describes the new head.
3. Reuse an exact-match packet; start the review now when none matches. A missing packet is work, not a blocker. If review-code dispatch is unavailable, return exactly `blocked: needs a coordinator with Agent-tool dispatch`.
4. After phase 9, re-snapshot once with `/pr info`. If the head differs from the reviewed head, run phase 6 for that head once, then phases 7–9 as needed. If the head still differs, return `blocked: external head churn — head differs after the one permitted reconciliation; unblock requires: a stable head with matching coverage`.
5. Failed setup or an unexpected working-tree state stops `blocked`. Fix what can be fixed first.

## Completion

A run ends only as one of:

- `complete`: current head has an exact-match complete `clean` packet (or `clean` docs-only entry), no unresolved requests or threads, and every expected required check passed. The PR is ready for human approval; with `automerge`, it is also merged.
- `pending` (bare `/pr` only; `automerge` waits in phase 10): same packet and threads, but required CI is still running. Not success. Do not wait: once checks finish, prflow tick sends a `ci` brief on a failure and updates the board card.
- `forced`: `force` was applied (including `automerge force` with unmet gates). Report it as complete with the overridden gates listed.
- `blocked`: the `gates.md` blocked form, naming what is left and what unblocks it.

Setup finishing or green CI alone is never completion. Never end `changes_required` or `incomplete` without first attempting the fix within the round limit.

## Safety Rules

- Never continue uncommitted work on `main` or `develop` without first branching and committing.
- Never post review comments or approve from the lifecycle. Review publication requires a mode-less explicit `/pr review` invocation on another author's PR. Automatic remediation is `fix` mode on your own PR, after ownership, branch, clean-tree, and current-head checks.
- Never reset or nest a review loop within an invocation, or skip fix-head review.
- Never create a PR with raw `gh pr create` or reuse a commit message as the body.
- Never merge without `automerge` or an explicit `/pr merge`.
- After `automerge` merges, phase 10 removes the current linked Orca-managed worktree automatically, with no confirmation, under the conditions in `merge.md`. Before ending, report `skipped (Orca unavailable)` or `skipped (outside Orca)` when applicable, and report every other cleanup failure. The primary checkout is synced instead. Ending the session is intended.

## Output Style

Report base/head/policy, branch and commit outcomes, PR, phases run and skipped, review depth chosen with reason, packet verdict and head, findings by ID, rounds used, required-CI state, overridden gates, merge result (`automerge` only), post-merge path (`primary synced/new session sent`, `worktree removal started (id)`, `skipped (Orca unavailable)`, `skipped (outside Orca)`, or `cleanup failed: <concrete reason>`), and what remains to reach merge.
