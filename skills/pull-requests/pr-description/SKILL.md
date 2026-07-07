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

## Guidelines

- Do not write from commit messages alone; use the diff.
- Do not credit agents (Claude Code, Codex, etc.) for writing the description.
- Do not reference filepaths in the summary.
- Do not reference uncommitted plan files.
- Do not structure the content according to implementation order.
- Use appropriate subsections in `What changed` section

## Implementation Notes

- If `gh pr edit --body-file <file>` fails on the deprecated `projectCards` GraphQL field (`repository.pullRequest.projectCards`), it does **not** update the body. Fall back to the REST API: `gh api -X PATCH repos/<owner>/<repo>/pulls/<number> -F body=@<file>` (resolve `<owner>/<repo>` via `gh repo view --json nameWithOwner -q .nameWithOwner`).
- Always verify by re-reading the body afterward: `gh pr view <number> --json body -q .body`.

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
