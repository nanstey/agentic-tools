---
name: worktree
description: Creates or reuses a git worktree for a branch and reports its ready-to-use path, using Orca-managed worktrees when the Orca IDE runs this repo. Use before starting any new unit of work (feature, fix, task) and when the user wants to work on a branch in its own worktree, e.g. `/worktree <branch-name>`.
user-invocable: true
disable-model-invocation: false
---

# Worktree

## Core Contract

Ensure a usable worktree exists for the requested branch, creating the branch and/or worktree as needed, then report the path.
Works whether the branch exists locally, only on the remote, or not at all, and whether a worktree is already registered.
Starting a new unit of work (feature, fix, task) without an explicit branch: derive a conventional `<type>/<slug>` branch name from the request and proceed; never start new work on the default branch's main checkout.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. `branch` (required; derive from the task when starting new work without one).
2. Optional worktree `path` (default: sibling of the main checkout, `../<repo>-<branch-with-slashes-as-dashes>`). Ignored on the Orca backend, which places worktrees itself.

## Backend Selection

Prefer Orca-managed worktrees so the checkout appears in the Orca IDE with metadata, lineage, and terminals. Fall back to plain git otherwise.

1. Resolve the Orca executable (`ORCA` below): use `$ORCA_CLI_COMMAND` if set; else `orca-dev` when `ORCA_DEV_REPO_ROOT` is set; else `orca-ide` on Linux outside an Orca-managed terminal (never bare `orca` there — it resolves to the GNOME screen reader); else `orca`.
2. Use the Orca backend when the resolved executable exists, `ORCA status --json` reports the app running, and the current repo is Orca-managed (`ORCA worktree current --json` or `ORCA worktree list --json` covers it).
3. Any of those checks fails → use the git backend. Do not start the Orca app just to create a worktree unless the user asked for Orca.

## Workflow (Orca backend)

1. Check `ORCA worktree list --json` for an existing worktree on `branch`; if one exists, reuse it and skip to step 3.
2. Create: `ORCA worktree create --name <branch> --base-branch <ref> --json` (omit `--base-branch` to use the repo default base). Related to the current context: keep the inferred parent or pass `--parent-worktree active`; independent work: pass `--no-parent`. Read the absolute path from the JSON result.
3. Report the path and resolution mode. Flag drift (`--help`, unknown flags) instead of guessing; the full version-matched reference is `ORCA skills get orca-cli`.

## Workflow (git backend)

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

- Never use `git worktree add --force`, `git worktree remove`, or `ORCA worktree rm`; this skill only creates and reuses.
- Never overwrite an existing non-empty directory at the target path; pick or ask for another path.
- Never delete or move branches; only create new ones when the branch doesn't exist.
- Never create a new branch from a stale base; fetch first and base new branches on `origin/HEAD` (git backend) or the repo default base (Orca backend).

## Output Style

Report branch, absolute worktree path, backend (orca / git), resolution mode (reused / created), and the base ref for newly created branches. End with a `cd <path>` hint.
