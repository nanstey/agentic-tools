---
name: rebase
description: Execute a safe single-branch rebase primitive with explicit inputs (branch, new base, optional old base tip, optional lease SHA), delegate conflicts to the conflicts skill, then optionally force-push with lease. Use when the user wants one branch rebased directly, or when higher-level workflows (like pr-rebase or pr-restack) need a reusable rebase execution step.
---

# Rebase

## Core Contract

Use this skill as the **single-branch rebase execution primitive**. It supports:

- normal local rebase (`git rebase origin/<new-base>`), and
- explicit transplant mode (`git rebase --onto <new-base> <old-base-tip> <branch>`), used by stacked-branch workflows.

This is the general, PR-agnostic executor. `pr-rebase` and `pr-restack` should supply explicit inputs and delegate execution here.

Conflict resolution is delegated to the `conflicts` skill. Do not duplicate that logic here.

Keep `CLAUDE.md` and `AGENTS.md` as mandatory policy sources. If this skill conflicts with them, follow those files.

## Required Inputs

Gather (or infer when not provided):

1. `branch` — branch to rewrite (default: current branch).
2. `new_base` — upstream target to rebase onto (required; may be inferred for ad-hoc local use).
3. `old_base_tip` (optional) — if present, run `--onto` mode.
4. `push` — whether to push afterward (default: yes, with `--force-with-lease`).
5. `expected_remote_sha` (optional but recommended) — if present, enforce precise lease: `--force-with-lease=<branch>:<sha>`.

## Workflow

### 1. Intake and validation

1. Resolve `branch` (default `git branch --show-current`) and check it out.
2. Resolve `new_base`. For manual `/rebase` usage, infer from repo default branch (`git remote show origin` or `gh repo view --json defaultBranchRef`) only when user intent is clear; otherwise ask.
3. If `branch` is protected (e.g., `main`, `develop`, or repo-protected base), stop and ask.
4. Ensure a clean working tree. If dirty, stop and ask (offer commit/stash first).
5. Fetch target refs before rebasing: `git fetch origin --prune`.
6. Record pre-rebase SHA for reporting/recovery: `before_sha=$(git rev-parse "$branch")`.

### 2. Choose rebase mode

- **Standard mode** (no `old_base_tip`):  
  `git rebase "origin/<new_base>"`
- **Transplant mode** (`old_base_tip` provided):  
  `git rebase --onto "origin/<new_base>" "<old_base_tip>" "<branch>"`

Use transplant mode for stacked-branch restacks where only commits after `old_base_tip` should move.

### 3. Handle conflicts via the conflicts skill

If the rebase stops with conflicts, hand off to the **`conflicts`** skill — invoke it via the Skill tool where the harness supports skill invocation, otherwise follow its workflow. It resolves each file by branch intent and runs `git rebase --continue`, looping until the rebase finishes. Return here once the rebase completes.

### 4. Optional push

After a clean rebase:

- If `push=false`, stop and report.
- If `push=true` and `expected_remote_sha` is provided:  
  `git push --force-with-lease="<branch>:<expected_remote_sha>" origin "<branch>"`
- If `push=true` without explicit lease SHA (ad-hoc mode):  
  `git push --force-with-lease origin "<branch>"`

If lease is rejected, remote moved. Fetch, reconcile, and ask before retrying. Never use plain `--force`.

### 5. Report

Summarize before/after SHA, mode used (standard vs transplant), conflict handling, and push outcome.

## Implementation Notes

- Useful commands: `git fetch origin --prune`, `git rebase origin/<new_base>`, `git rebase --onto origin/<new_base> <old_base_tip> <branch>`, `git rebase --abort` (only if user asks), `git push --force-with-lease`.
- Base detection for ad-hoc use: `git remote show origin`, or `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`.
- Conflicts: defer entirely to `skills/dev/conflicts`.

## Safety Rules

- Never run on, or force-push, protected base branches.
- Never rebase with a dirty working tree; commit or stash first (ask the user).
- Use `--force-with-lease`, never plain `--force`.
- Do not resolve conflicts inline — delegate to `conflicts`.
- Only abort the rebase if the user asks.
- If `--force-with-lease` is rejected, stop and reconcile rather than overwriting.
- In transplant mode, never guess `old_base_tip`; require explicit input from the caller or ask.

## Output Style

When finishing, report:

1. Branch rewritten and `before_sha -> after_sha`.
2. Rebase mode used (`standard` or `transplant`) and the base input(s).
3. Whether conflicts occurred and that `conflicts` handled them.
4. Whether and how the branch was pushed (including lease style).
5. Any stop-and-ask gates encountered.
