---
name: pr-description
description: Refreshes PR descriptions to match the current branch changeset. Use when the PR body has drifted from the code.
---

# PR Description

## Core Contract

Sync PR body with the current branch diff.
Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.
Default behavior is to update the PR directly once rewritten.

## Required Inputs

1. PR URL if provided, else current branch.
2. Matching PR and base branch.

## Workflow

1. Resolve PR via `pr-info`.
2. If no PR exists, stop and suggest `pr-create`.
3. Read current body and metadata.
4. Analyze `base...HEAD` diff (`git log`, `git diff --stat`, `git diff`).
5. Identify drift: missing changes, stale bullets, stale/complete checklist items.
6. Rewrite concise body (typically `Summary`, `What Changed`, optional `Testing`/`Open Questions`).
7. Preserve still-relevant links/issues/related PR refs.
8. Update PR body via `gh` and verify by re-reading PR.

Do not write from commit messages alone; use the diff.

## Safety Rules

- Never assume the current branch has exactly one PR without verifying it.
- Never rewrite the PR body before reading the existing body.
- Never base the description only on commit titles when the diff is available.
- Never remove links or attachments unless there is evidence they are stale or irrelevant.
- Never check off a checklist item unless the changeset supports that inference with reasonable confidence.
- Never preserve stale descriptive bullets that conflict with the current branch state.
- Never overwrite unrelated user work in the repository while gathering context.
- If unexpected working tree changes appear while you are working, stop and ask the user how to proceed.

## Output Style

Report PR updated, base used for drift analysis, major drift found, and what sections were rewritten/preserved/checked/removed.
