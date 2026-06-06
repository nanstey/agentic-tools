---
name: commit
description: Creates well-formed commit(s) from current changes with grouped diffs and clear messages. Use when current work is ready to commit.
---

# Commit

## Core Contract

Turn current changes into clean commit(s), then push to `origin` by default.
Inspect real diffs first and follow repo commit conventions.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch and protection status.
2. Scope to commit.
3. Commit grouping plan.
4. Commit message(s).
5. Push preference (default: push).

## Workflow

1. Use `changes` output (or equivalent diff review) to define commit groups.
2. Confirm plan before staging when grouping/scope is ambiguous.
3. Re-check `git status --porcelain` and diffs right before staging.
4. Stage only intended hunks/files; avoid blind adds.
5. Write concise messages matching repo style.
6. Run and honor hooks; fix failures.
7. Commit and push (`git push -u` on first branch push).
8. If tree is clean, report and stop.

Stop and ask before committing on protected branches or if unexpected changes appear.

## Safety Rules

- Never commit secrets, credentials, or large build artifacts; scan the diff first.
- Never blind-stage everything without reviewing what is included.
- Never amend or rewrite already-pushed commits unless the user asks.
- Confirm before committing on `main`, `develop`, or another protected base.
- Do not bypass failing hooks with `--no-verify` unless explicitly told.
- Push to `origin` by default; skip push only if the user asks.
- If unexpected or unrelated changes appear, stop and ask the user how to proceed.

## Output Style

Report branch, commit hashes/subjects, grouping, hook actions, anything intentionally left out, and push status.
