---
name: pr-ci
description: Investigates and fixes failed PR CI jobs end-to-end for the current branch. Use when branch CI failures need resolution.
---

# PR CI

## Core Contract

Investigate and fix failed CI for the current branch PR end-to-end.
Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.
Default flow includes fix, validation, commit, and push unless user scopes it down.

## Required Inputs

1. Current branch.
2. Matching PR.
3. Requested scope (full flow or investigation only).

## Workflow

1. Resolve PR via `pr-info`.
2. Read failed completed checks/runs (`gh pr checks`, `gh run view --log`).
3. Group failures by root cause; keep evidence per group.
4. Classify each root cause: real code issue, already fixed, flaky, external, or unclear.
5. Fix real code issues with minimal scoped changes.
6. Validate touched areas (lint/typecheck/tests as relevant).
7. Commit and push only when code changed and validation passed.
8. Report rerun guidance and unresolved flaky/external blockers.

Stop and ask before risky architecture/product decisions or ambiguous trade-offs.

## Safety Rules

- Never assume the current branch has a unique open PR; discover and verify it.
- Never rely only on check summaries when logs are available.
- Never treat duplicate failed jobs as separate root causes without evidence.
- Never create an empty commit just to mark CI progress.
- Never push if validation is failing.
- Never force-push unless explicitly requested.
- Never overwrite or revert unrelated user changes.
- Never fabricate code changes for flaky or infrastructure failures.
- If unexpected changes appear while working, stop and ask the user how to proceed.

## Output Style

Report failed jobs, grouped root causes, what was fixed, what was already fixed/flaky/external, commit message (if any), push status, and rerun/blocker guidance.
