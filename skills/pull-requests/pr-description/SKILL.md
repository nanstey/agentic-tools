---
name: pr-description
description: Refreshes PR titles and descriptions to match the current branch changeset. Use when the PR title or body has drifted from the code.
---

# PR Description

## Core Contract

Sync PR title and body with the current branch diff.
Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.
Default behavior is to update the PR directly once rewritten.

## Required Inputs

1. PR URL if provided, else current branch.
2. Matching PR and base branch.

## Workflow

1. Resolve PR via `pr-info`.
2. If no PR exists, stop and suggest `pr-create`.
3. Read current title, body, and metadata.
4. Analyze the exact PR changes over `pr-info`'s authoritative comparison: `git diff <baseRefOid>..<headRefOid>`, `git diff --stat <baseRefOid>..<headRefOid>`, and `git log <baseRefOid>..<headRefOid>` for the commit list.
5. Identify drift: stale title, missing changes, stale bullets, stale/complete checklist items.
6. If the branch changes user-facing UI, run `pr-screenshots` to ensure the PR's visual evidence is current before finalizing the body; wire any refreshed attachments into the description. Skip for non-UI changesets.
7. Rewrite concise body (typically `Summary`, `What Changed`, optional `Testing`/`Screenshots`/`Open Questions`).
8. If the title no longer summarizes the changeset, rewrite it (concise, imperative, matching repo convention such as Conventional Commits when in use).
9. Preserve still-relevant links/issues/related PR refs, including current screenshot/clip attachments.
10. Update the PR title (only if drifted) and body via `gh`, then verify by re-reading the PR.

## Guidelines

- Do not write from commit messages alone; use the diff.
- Do not credit agents (Claude Code, Codex, etc.) for writing the description.
- Do not reference filepaths in the summary.
- Do not reference uncommitted plan files.
- Screenshots/clips belong as PR attachments, never committed to the repo; delegate their capture and refresh to `pr-screenshots`.
- Do not structure the content according to implementation order.
- Use appropriate subsections in `What changed` section

## Implementation Notes

- Update the title with `gh pr edit <number> --title <title>` only when it has drifted; skip the flag otherwise to avoid a no-op edit.
- If `gh pr edit --body-file <file>` fails on the deprecated `projectCards` GraphQL field (`repository.pullRequest.projectCards`), it does **not** update the body. Fall back to the REST API: `gh api -X PATCH repos/<owner>/<repo>/pulls/<number> -F body=@<file>` (resolve `<owner>/<repo>` via `gh repo view --json nameWithOwner -q .nameWithOwner`). The same REST call accepts `-F title=<title>` when the `gh pr edit` title update also fails.
- Always verify by re-reading afterward: `gh pr view <number> --json title,body -q '.title, .body'`.

## Safety Rules

- Never assume the current branch has exactly one PR without verifying it.
- Never rewrite the PR body or title before reading the existing values.
- Never change the title when it still accurately summarizes the changeset; only update on genuine drift.
- Never base the description only on commit titles when the diff is available.
- Never remove links or attachments unless there is evidence they are stale or irrelevant.
- Never check off a checklist item unless the changeset supports that inference with reasonable confidence.
- Never preserve stale descriptive bullets that conflict with the current branch state.
- Never leave stale screenshots in a UI PR body; refresh via `pr-screenshots`, and never commit the artifacts to the repo.
- Never overwrite unrelated user work in the repository while gathering context.
- If unexpected working tree changes appear while you are working, stop and ask the user how to proceed.

## Output Style

Report PR updated, base used for drift analysis, whether the title drifted (old → new, or unchanged), major body drift found, and what sections were rewritten/preserved/checked/removed.
