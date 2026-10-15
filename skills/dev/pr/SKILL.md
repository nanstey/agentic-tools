---
name: pr
description: Runs PR creation, maintenance, and stacked-PR workflows from one command. Use when a branch or pull request needs creation, reconciliation, remediation, publication, merge, or stack management.
argument-hint: "[info|monitor|merge|ci|create|comments|description|screenshots|rebase|restack|split|stack|auto-merge] [PR-URL-or-number]"
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
| `/pr description [target]` | [`description.md`](references/description.md) |
| `/pr screenshots [target]` | [`screenshots.md`](references/screenshots.md) |
| `/pr rebase [target]` | [`rebase.md`](references/rebase.md) |
| `/pr restack [target]` | [`restack.md`](references/restack.md) |
| `/pr split [target]` | [`split.md`](references/split.md) |
| `/pr stack [target-or-operation]` | [`stack.md`](references/stack.md) |

Reject an unknown action, more than one action word, or legacy `--` action flags. A supplied PR URL or number is the target; otherwise references resolve the current branch as specified.

## Safety Dispatch Rules

Load every referenced workflow before acting and preserve its stop gates, safety rules, and output requirements. Lifecycle and `auto-merge` subsequently load their targeted action references. The `stack` reference loads its CLI, REST API, and workflow companions only when their details are needed.

Never bypass a referenced workflow's verification, approval, or stop gate. Do not silently substitute a direct implementation for a dispatched workflow.

## Non-Interactive Policy

Never ask the user a question, request clarification, or wait for approval. Every decision resolves in this order:

1. An explicit input in the invocation or the user's request.
2. Repository instructions (`CLAUDE.md` / `AGENTS.md`, PR templates, `CONTRIBUTING*`).
3. The documented default in the dispatched reference.
4. Otherwise stop as `blocked`: make no further changes, report the blocker, and give the exact input or command that unblocks it.

Invoking an action authorizes the mutations that action declares. Destructive extras (pruning branches, dissolving a stack, aborting an operation) run only when the invocation names them, never by prompt. References that say "stop" mean stop with a `blocked` report; they never mean ask.

## Output Behavior

Report the selected action, resolved target, workflow outcome, and any inherited blocker. Each detailed reference defines additional required output.
