---
name: pr
description: Runs PR creation, maintenance, and stacked-PR workflows from one command. Use when a branch or pull request needs creation, reconciliation, remediation, publication, merge, or stack management.
argument-hint: "[info|monitor|merge|ci|create|comments|review|verification|ready|description|screenshots|push|rebase|restack|split|stack|auto-merge] [PR-URL-or-number] [fix|comment]"
user-invocable: true
disable-model-invocation: false
---

# PR

## Command Grammar and Dispatch

`/pr [action] [target-or-action-arguments]` is the sole pull-request command. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Default GitHub tool is `gh`.

With no action, load [`references/lifecycle.md`](references/lifecycle.md) and run the creation-and-maintenance lifecycle. `auto-merge` loads that same reference and runs its lifecycle through merge. All other action words load exactly the mapped reference before execution:

| Invocation | Reference |
| --- | --- |
| `/pr` | [`lifecycle.md`](references/lifecycle.md) |
| `/pr auto-merge [target]` | [`lifecycle.md`](references/lifecycle.md) |
| `/pr info [target]` | [`info.md`](references/info.md) |
| `/pr monitor [target] [mode: once]` | [`monitor.md`](references/monitor.md) |
| `/pr merge [target]` | [`merge.md`](references/merge.md) |
| `/pr ci [target]` | [`ci.md`](references/ci.md) |
| `/pr create [target]` | [`create.md`](references/create.md) |
| `/pr comments [target]` | [`comments.md`](references/comments.md) |
| `/pr review [target] [fix\|comment]` | [`review.md`](references/review.md) → [`review-code`](../../workflow/review-code/SKILL.md) |
| `/pr verification [target] [report\|fix\|comment]` | [`verification.md`](references/verification.md) |
| `/pr ready [target]` | [`ready.md`](references/ready.md) |
| `/pr description [target]` | [`description.md`](references/description.md) |
| `/pr screenshots [target]` | [`screenshots.md`](references/screenshots.md) |
| `/pr push [target]` | [`push.md`](references/push.md) |
| `/pr rebase [target]` | [`rebase.md`](references/rebase.md) |
| `/pr restack [target]` | [`restack.md`](references/restack.md) |
| `/pr split [target]` | [`split.md`](references/split.md) |
| `/pr stack [target-or-operation]` | [`stack.md`](references/stack.md) |

Reject an unknown action, more than one action word, or legacy `--` action flags. A supplied PR URL or number is the target; otherwise references resolve the current branch as specified.

## Safety Dispatch Rules

Load every referenced workflow before acting and preserve its stop gates, safety rules, and output requirements. Lifecycle and `auto-merge` subsequently load their targeted action references. The `stack` reference loads its CLI, REST API, and workflow companions only when their details are needed.

Never bypass a referenced workflow's verification, approval, or stop gate. Do not silently substitute a direct implementation for a dispatched workflow.

Lifecycle, review, CI/comment fixes, monitor, ready, and merge share [`references/gates.md`](references/gates.md): authoritative outcome/check/review evidence, finding categories, and one caller-owned three-round review/fix budget including initial review. Carry that state across dispatches; never reset it or start nested review loops. `/pr review` delegates code review to `review-code` and retains PR actions and round-state ownership. It defaults to report-only (no edits, tests, commits, pushes, comments, or approval); source-review cleanliness alone grants no readiness permission.

`/pr verification` is a sibling that defaults to report and audits the description/screenshots without starting review loops. Reuse a caller-supplied `review-code` verification result matching base/head/claim set/environment; otherwise run base verification. Never rerun covered claim checks.

## Non-Interactive Policy

Never ask the user a question, request clarification, or wait for approval. Every decision resolves in this order:

1. An explicit input in the invocation or the user's request.
2. Repository instructions (`CLAUDE.md` / `AGENTS.md`, PR templates, `CONTRIBUTING*`).
3. The documented default in the dispatched reference.
4. Otherwise use best judgment: choose the safest reversible option that satisfies the request and record it.
5. Stop as `blocked` only when the action would be destructive or hard to reverse, or no workaround exists: make no further changes, report the blocker, and give the exact input or command that unblocks it.

Invoking an action authorizes the mutations that action declares. Destructive extras (pruning branches, dissolving a stack, aborting an operation) run only when the invocation names them, never by prompt. References that say "stop" mean stop with a `blocked` report; they never mean ask.

## Output Behavior

Report the selected action, resolved target, workflow outcome, and any inherited blocker. Each detailed reference defines additional required output.
