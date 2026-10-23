# PR Lifecycle

## Core Contract

Push the PR as close to merge as one run can. Detect where the PR is, run each unmet phase in order, and continue until it is ready and monitored (or merged, with `auto-merge`). A run never stops to warn: it does the work, or reports the exact thing that cannot be done.

Load [`gates.md`](gates.md) for evidence, review depth, force, and the round limit. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

- `/pr`: phases 0–10, ending at merge-ready. Merge needs `/pr merge` or `auto-merge`.
- `/pr auto-merge [target]`: phases 0–10, then phase 11 (`/pr merge`) once monitor returns `clean`. With `force`, both monitor passes use `mode: once`, and phase 11 runs after the last monitor attempt (one, or two after head reconciliation) whatever it returns; non-`clean` results are recorded as overridden gates.
- `force` on either: apply the `gates.md` force override to soft gates instead of blocking.

## Inputs

1. Current branch, or PR URL/number.
2. Optional `auto-merge` and `force`.
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
| 5 | CI | Outcome unobserved, or an expected required check failed, is missing, or is still pending | `/pr ci`: fix and publish. Pending independent checks are waited on (poll as monitor does) until terminal before phase 6; `force` proceeds without waiting. |
| 6 | Review | No exact-match complete packet or `clean` docs-only entry for this head | Own PR: `/pr review <PR> fix`. Other author's PR: `/pr review <PR>` report-only. Depth follows `gates.md` review depth. |
| 7 | Threads | Unresolved review threads | `/pr comments` |
| 8 | Verify | Claims lack cited evidence in the body | `/pr verification fix` (own PR) |
| 9 | Ready | PR is draft and phases 1–8 pass | `/pr ready` |
| 10 | Monitor | Always, last | `/pr monitor` with `mode: once` (`mode: monitor` for `auto-merge`, but `mode: once` under `force` so pending CI cannot loop forever) |
| 11 | Merge | `auto-merge` and monitor `clean` (under `force`: after the monitor attempt, any result) | `/pr merge` (with `force` if given) |

Phase order matches the gate order in `gates.md`: outcome and independent CI before quality and security review, review-dependent CI after.

### Rules for the run

1. Run phases back-to-back. Never pause between phases or review/fix rounds to ask whether to continue.
2. Publish every change through `/pr push`, which describes the new head.
3. Reuse an exact-match packet; start the review now when none matches. A missing packet is work, not a blocker. If review-code dispatch is unavailable, return exactly `blocked: needs a coordinator with subagent dispatch`.
4. Monitor owns PR health after phase 9. It requests only missing or invalidated coverage, never a duplicate full review. The lifecycle cannot return before monitor does.
5. If monitor returns `clean`, or `pending` in `mode: once`, for a head different from the reviewed head, reconcile exactly once: reuse monitor's exact-match fresh coverage, or run phase 6 for that head, then rerun monitor in the same mode. If the head still differs, return `blocked: external head churn or no progress — monitor head differs after the one permitted reconciliation; unblock requires: a stable head with matching coverage and monitor result`. With `auto-merge`, the second monitor must return `clean` before merging, except under `force`.
6. Failed setup or an unexpected working-tree state stops `blocked`. Fix what can be fixed first.

## Completion

A run ends only as one of:

- `complete`: current head has an exact-match complete `clean` packet (or `clean` docs-only entry) and monitor returned `clean`. The PR is ready for human approval; with `auto-merge`, it is also merged.
- `pending`: same packet, but monitor returned `pending` in `mode: once` (usually required CI still running). Not success; the PR is ready for review once CI passes.
- `forced`: `force` was applied (including `auto-merge force` through an unclean monitor). Report it as complete with the overridden gates listed.
- `blocked`: the `gates.md` blocked form, naming what is left and what unblocks it.

Setup finishing or green CI alone is never completion. Never end `changes_required` or `incomplete` without first attempting the fix within the round limit.

## Safety Rules

- Never continue uncommitted work on `main` or `develop` without first branching and committing.
- Never post review comments or approve from the lifecycle. Automatic remediation is `fix` mode on your own PR, after ownership, branch, clean-tree, and current-head checks.
- Never reset or nest a review loop within an invocation, or skip fix-head review.
- Never create a PR with raw `gh pr create` or reuse a commit message as the body.
- Never merge without `auto-merge` or an explicit `/pr merge`.

## Output Style

Report base/head/policy, branch and commit outcomes, PR, phases run and skipped, review depth chosen with reason, packet verdict and head, findings by ID, rounds used, monitor result, overridden gates, merge result (`auto-merge` only), and what remains to reach merge.
