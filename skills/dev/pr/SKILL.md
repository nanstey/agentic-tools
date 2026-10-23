---
name: pr
description: Runs PR creation, maintenance, and stacked-PR workflows from one command. Use when a branch or pull request needs creation, reconciliation, remediation, publication, merge, or stack management.
argument-hint: "[info|create|push|description|screenshots|rebase|restack|split|stack|ci|review|comments|verification|ready|monitor|merge|auto-merge] [PR-URL-or-number] [fix|comment] [force]"
user-invocable: true
disable-model-invocation: false
---

# PR

Every `/pr` run pushes the PR as far toward merge as it can. Bias to action: do the missing work, don't warn about it or refuse.

## Lifecycle

Subcommands follow the order a PR moves through. Bare `/pr` detects the first unmet phase, runs it, re-snapshots, and continues through later phases. It skips satisfied phases and stops at merge-ready (see [`lifecycle.md`](references/lifecycle.md)).

| # | Phase | Goal | Subcommand | Reference |
| --- | --- | --- | --- | --- |
| 0 | Resolve | Find the PR, branch, and state | `/pr info [target]` | [`info.md`](references/info.md) |
| 1 | Create | Open a draft PR with a real description | `/pr create [target]` | [`create.md`](references/create.md) |
| 2 | Publish | Commit and push changes to the PR branch | `/pr push [target]` | [`push.md`](references/push.md) |
| 3 | Describe | Body and screenshots match the head | `/pr description [target]`, `/pr screenshots [target]` | [`description.md`](references/description.md), [`screenshots.md`](references/screenshots.md) |
| 4 | Sync | Current with base; stack in order | `/pr rebase [target]`, `/pr restack [target]`, `/pr stack [target-or-operation]`, `/pr split [target]` | [`rebase.md`](references/rebase.md), [`restack.md`](references/restack.md), [`stack.md`](references/stack.md), [`split.md`](references/split.md) |
| 5 | CI | Required checks pass | `/pr ci [target]` | [`ci.md`](references/ci.md) |
| 6 | Review | Quality and security review, depth scaled to the change | `/pr review [target] [fix\|comment]` | [`review.md`](references/review.md) → [`review-code`](../../workflow/review-code/SKILL.md) |
| 7 | Threads | Review comments addressed | `/pr comments [target]` | [`comments.md`](references/comments.md) |
| 8 | Verify | Claims have cited evidence | `/pr verification [target] [report\|fix\|comment]` | [`verification.md`](references/verification.md) |
| 9 | Ready | Draft becomes ready for review | `/pr ready [target]` | [`ready.md`](references/ready.md) |
| 10 | Monitor | Re-observe until clean | `/pr monitor [target] [mode: once]` | [`monitor.md`](references/monitor.md) |
| 11 | Merge | Squash-merge | `/pr merge [target] [force]` | [`merge.md`](references/merge.md) |

`/pr` runs phases 0–10 and stops at merge-ready. `/pr auto-merge [target]` runs the same lifecycle, then phase 11. Both load [`lifecycle.md`](references/lifecycle.md). Every other action loads exactly its mapped reference.

Reject an unknown action, more than one action word, or legacy `--` action flags. A supplied PR URL or number is the target; otherwise references resolve the current branch. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Default GitHub tool is `gh`.

## Act, Don't Refuse

- An unmet gate is work to do. Run the phase that satisfies it (missing review: review; failing CI: fix; behind base: rebase; draft: ready). Do not report it and wait.
- Stop only when no workaround exists: no PR, no auth or access, a product decision the evidence cannot settle, or a destructive action the invocation did not name. Report what is left, in the `gates.md` blocked form.
- The user can always push forward. `force` (accepted by bare `/pr`, `auto-merge`, `ready`, and `merge`; other actions ignore it) overrides every soft gate in [`gates.md`](references/gates.md): run the action with the gaps recorded, not fixed. `/pr merge force` merges even when CI, review, threads, or approvals are incomplete.
- `force` never invents evidence. Record each overridden gate in the output so the result stays honest.

## Shared Rules

Load every referenced workflow before acting. [`gates.md`](references/gates.md) owns evidence, review depth scaling, finding categories, the force override, and the per-invocation three-round fix limit. Delegates inside an invocation share that limit; separate invocations do not carry it. Never reset it mid-invocation or start nested review loops.

`/pr review` delegates code review to `review-code` and keeps PR actions and round-state ownership. It defaults to report-only. `/pr verification` defaults to report and audits the description and screenshots without starting review loops.

## Non-Interactive Policy

Never ask the user a question or wait for approval. Resolve every decision in this order:

1. An explicit input in the invocation or the user's request.
2. Repository instructions (`CLAUDE.md` / `AGENTS.md`, PR templates, `CONTRIBUTING*`).
3. The documented default in the dispatched reference.
4. Best judgment: the option that moves the PR toward merge and is reversible. Record it.
5. Stop as `blocked` only when the action would be destructive or hard to reverse and the invocation did not name it, or no workaround exists.

Invoking an action authorizes the mutations it declares. Destructive extras (pruning branches, dissolving a stack, aborting an operation) run only when the invocation names them. References that say "stop" mean a `blocked` report, never a question.

## Output Behavior

Report the action, resolved target, phases run, outcome, what remains to reach merge, and any overridden gates. Bare `/pr` and `auto-merge` also report the review verdict/head and monitor result.
