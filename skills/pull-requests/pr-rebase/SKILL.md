---
name: pr-rebase
description: Rebases the current branch onto its PR base and force-pushes with lease. Use when syncing a PR branch with its target base.
disable-model-invocation: true
---

# PR rebase (base-aware)

PR-aware wrapper around `rebase`.
Its job is to pin the base branch from PR metadata and carry PR intent into conflict resolution.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Steps

1. Resolve PR with `pr-info` and capture `baseRefName`, title, and body.
2. If no PR exists, ask whether to use generic `rebase` base detection or an explicit base.
3. Delegate to `rebase` with base pinned to PR base.
4. Let `conflicts` handle pauses.
5. Do not re-implement fetch/rebase/push logic here.

## Guards

- Do not run on `develop` or `main`; never force-push them. (`rebase` enforces this too.)
- Prefer `--force-with-lease` over `--force` so a mismatched remote aborts.
- If PR base metadata is missing or ambiguous, stop and ask instead of guessing.

## Output Style

Report PR resolved, base used, whether delegation to `rebase` completed, conflict status, and push result.
