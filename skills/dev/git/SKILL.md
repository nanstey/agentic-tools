---
name: git
description: Runs everyday git workflows from one command — branching, worktrees, change review, commits, rebasing, and conflict resolution. Use when work needs a branch or worktree, changes need grouping or committing, a branch needs rebasing, or a stopped merge/rebase has conflicts.
argument-hint: "[branch|worktree|changes|commit|rebase|conflicts] [action-arguments]"
user-invocable: true
disable-model-invocation: false
---

# Git

## Command Grammar and Dispatch

`/git <action> [action-arguments]` is the sole git workflow command. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Every action loads exactly the mapped reference before execution:

| Invocation | Reference |
| --- | --- |
| `/git branch [name]` | [`branch.md`](references/branch.md) |
| `/git worktree [branch]` | [`worktree.md`](references/worktree.md) |
| `/git changes [scope]` | [`changes.md`](references/changes.md) |
| `/git commit [scope]` | [`commit.md`](references/commit.md) |
| `/git rebase [branch] [new_base]` | [`rebase.md`](references/rebase.md) |
| `/git conflicts` | [`conflicts.md`](references/conflicts.md) |

With no action, infer one only when the request names it unambiguously (for example "commit this" or "resolve these conflicts"); otherwise choose the best-fit action from context. Reject an unknown action or more than one action word.

## Safety Dispatch Rules

Load every referenced workflow before acting and preserve its stop gates, safety rules, and output requirements. Actions delegate to one another by name: `commit` uses `changes`, `rebase` hands pauses to `conflicts`, `worktree` follows `branch` naming. Load the delegated reference when that step runs.

Never bypass a referenced workflow's verification, approval, or stop gate. Do not silently substitute a direct git command sequence for a dispatched workflow.

## Output Behavior

Report the selected action, resolved target (branch, path, or scope), workflow outcome, and any inherited blocker. Each detailed reference defines additional required output.
