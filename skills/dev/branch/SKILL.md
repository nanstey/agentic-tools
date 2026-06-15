---
name: branch
description: Creates a new git branch for current or proposed changes, deriving a conventional name when none is given. Use when the user wants to start a branch, e.g. `/branch <name?>`.
user-invocable: true
disable-model-invocation: false
---

# Branch

## Core Contract

Create a new git branch for the current changes or proposed work, using the supplied name or deriving one from the change content.
Branch names use a conventional type prefix (`feat/`, `fix/`, `chore/`, `docs/`, `ci/`, `style/`, `refactor/`, `test/`, `perf/`, `build/`).
Base new branches on a fresh default branch tip; never discard or commit existing work as a side effect.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Optional `name` (with or without a type prefix).
2. If no name: a description of the change, or current diff/status to infer one from.

## Workflow

1. Run `git status --short` and `git diff --stat` to capture the current change context.
2. Determine the branch name:
   - If `name` is given, use it; add a type prefix only when it lacks one.
   - Otherwise derive `<type>/<slug>` from the change content or the user's description.
   - Slug is lowercase-hyphenated, concise, and free of redundant words.
3. Pick the type prefix from the dominant change intent (`feat`, `fix`, `chore`, `docs`, `ci`, `style`, `refactor`, `test`, `perf`, `build`).
4. If the working tree is clean and no change is described, stop and ask what the branch is for.
5. Create the branch with `git checkout -b <name>`, basing it on a fresh `origin/HEAD` when current work should not carry over; keep uncommitted changes when they belong on the new branch.
6. Report the created branch name and its base.

Stop and ask if the name is ambiguous, collides with an existing branch, or the intended base is unclear.

## Safety Rules

- Never commit, stash, or discard changes as an implicit side effect of branching.
- Never overwrite or reset an existing branch; if the name exists, stop and ask.
- Never force-create from a stale base; fetch before basing a new branch on `origin/HEAD`.
- Never invent a name when the change intent is unknown; ask instead.

## Output Style

Report the new branch name, its base ref, whether the name was supplied or derived, and the chosen type prefix.
