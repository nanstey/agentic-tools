---
name: changes
description: Inspects staged and unstaged changes and groups them into coherent change sets. Use when reviewing what changed before committing.
---

# Changes

## Core Contract

Read-only change review: group current edits by intent and flag out-of-place items.
Always inspect real diffs and branch intent.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch and base.
2. Requested scope (all or paths).
3. Branch intent from history/name/PR.
4. Detail level (default: grouped breakdown).

## Workflow

1. Capture state with `git status --porcelain`, `git diff`, and `git diff --staged`.
2. Read branch context with `git log --oneline <base>..HEAD` and PR metadata.
3. Group changes by unit of work (feature/fix/refactor/test/docs), splitting hunks when needed.
4. Classify untracked files as relocation, net-new, or follow-on edits.
5. Flag unrelated/incidental/risky/inconsistent items with `file:line` references.
6. If the tree is clean, report and stop.

## Safety Rules

- Never stage, commit, push, amend, stash, reset, or discard. This skill only reads and reports.
- Never run `git add` — not even to inspect.
- Do not edit files to "clean up" what you flag; report it and let the user decide.
- If you spot a secret or credential, flag it prominently and do not echo its value in full.

## Output Style

Report branch/base, inferred purpose, logical groups, untracked classifications, flagged items with `file:line`, and whether splitting is recommended before commit.
