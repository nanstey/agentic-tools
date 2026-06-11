---
name: pr-comments
description: Resolves unresolved PR review comments with code changes, validation, and thread follow-up. Use when review feedback must be addressed end-to-end.
---

# Address PR Comments

## Core Contract

Address unresolved PR review threads end-to-end on the current branch.
Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch.
2. Matching PR.
3. Whether commit/push should be performed.

## Workflow

1. Resolve PR via `pr-info`.
2. Load unresolved threads (prefer GraphQL for thread-level state).
3. Triage each thread: implement, already-addressed, explain non-action, or escalate.
4. Apply worthwhile code changes with minimal scope.
5. Validate touched areas before commit.
6. Commit and push when code changed and validation passed.
7. Resolve/reply to each thread only after branch state is final.
8. Leave unresolved threads open and report blockers.

Stop and ask when feedback implies product/architecture decisions or high-risk trade-offs.

## Safety Rules

- Never assume the current branch has a unique open PR; discover and verify it.
- Never resolve comments before the branch state is finalized.
- Never create an empty commit to mark review progress.
- Never push or resolve threads if validation is failing.
- Never force-push unless explicitly requested.
- Never overwrite or revert unrelated user changes.
- If unexpected changes appear while working, stop and ask the user how to proceed.

## Output Style

Report threads fixed with code, resolved without code, replied-with-explanation, commit message (if any), push status, and unresolved blockers.
