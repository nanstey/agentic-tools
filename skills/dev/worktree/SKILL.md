---
name: worktree
description: Creates or reuses a git worktree for a branch and reports its ready-to-use path. Use when the user wants to work on a branch in its own worktree, e.g. `/worktree <branch-name>`.
user-invocable: true
disable-model-invocation: false
---

# Worktree

## Core Contract

Ensure a usable worktree exists for the requested branch, creating the branch and/or worktree as needed, then report the path.
Works whether the branch exists locally, only on the remote, or not at all, and whether a worktree is already registered.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. `branch` (required).
2. Optional worktree `path` (default: sibling of the main checkout, `../<repo>-<branch-with-slashes-as-dashes>`).

## Workflow

1. Run `git fetch --prune` to refresh remote refs.
2. Check `git worktree list --porcelain` for an existing worktree on `branch`:
   - If found and the directory exists, reuse it and skip to step 5.
   - If registered but the directory is missing, run `git worktree prune`, then continue.
3. Classify the branch:
   - Local branch exists: `git worktree add <path> <branch>`.
   - Remote-only (`origin/<branch>`): `git worktree add <path> -b <branch> --track origin/<branch>`.
   - Doesn't exist: `git worktree add <path> -b <branch>` from the default branch tip (`origin/HEAD`).
4. If `git worktree add` fails because the branch is checked out elsewhere, report that location instead of forcing.
5. Report the absolute worktree path and how it was resolved (reused / created from local / tracked remote / new branch).

## Safety Rules

- Never use `git worktree add --force` or `git worktree remove`; this skill only creates and reuses.
- Never overwrite an existing non-empty directory at the target path; pick or ask for another path.
- Never delete or move branches; only create new ones when the branch doesn't exist.
- Never create a new branch from a stale base; fetch first and base new branches on `origin/HEAD`.

## Output Style

Report branch, absolute worktree path, resolution mode (reused / created), and the base ref for newly created branches. End with a `cd <path>` hint.
