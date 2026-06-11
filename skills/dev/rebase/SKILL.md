---
name: rebase
description: Rebases one branch onto a new base with conflict delegation and optional force-push lease. Use when a branch needs safe direct rebasing.
---

# Rebase

## Core Contract

Single-branch rebase executor for standard and transplant (`--onto`) rebases.
Delegate conflict handling to `conflicts`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. `branch` (default current).
2. `new_base` (required).
3. Optional `old_base_tip` for transplant mode.
4. `push` (default true).
5. Optional `expected_remote_sha` for strict lease.

## Workflow

1. Validate branch/base inputs, guard protected branches, require clean tree.
2. Fetch refs and record pre-rebase SHA.
3. Run standard rebase or transplant rebase (`--onto`) per inputs.
4. If conflicts occur, hand off to `conflicts` until rebase completes.
5. Push with `--force-with-lease` when enabled.
6. If lease fails, stop and reconcile before retrying.

## Safety Rules

- Never run on, or force-push, protected base branches.
- Never rebase with a dirty working tree; commit or stash first (ask the user).
- Use `--force-with-lease`, never plain `--force`.
- Do not resolve conflicts inline; delegate to `conflicts`.
- Only abort the rebase if the user asks.
- If `--force-with-lease` is rejected, stop and reconcile rather than overwriting.
- In transplant mode, never guess `old_base_tip`; require explicit input from the caller or ask.

## Output Style

Report branch and `before -> after` SHA, mode used, conflict handling status, push/lease result, and any stop-and-ask gates.
