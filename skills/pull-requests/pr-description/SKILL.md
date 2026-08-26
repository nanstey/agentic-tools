---
name: pr-description
description: Refreshes PR titles and descriptions to match the current branch changeset. Use when the PR title or body has drifted from the code.
---

# PR Description

## Core Contract

Sync PR title and body with the current branch diff.
Write BLUF (Bottom Line Up Front): lead with the main point, then follow with context. State the conclusion before the material that justifies it, so a time-constrained reviewer grasps what changed and what is needed of them from the first line.
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
7. Draft the body in the fixed format (see `Template`): `Summary`, `Changes`, `Testing`, optional `Notes`, optional `Screenshots`.
8. Self-review the draft once against the checks below, revise, then move on. One pass — not a loop.
   - **Length**: under the ceiling for the change size (see `Length`); cut, do not pad. No sentence or bullet over ~25 words — split any that run long.
   - **No rationale**: `Summary` and `Changes` state what changed, not why; drop justification and design narration unless a reviewer cannot trust or navigate the change without it, and then in one clause.
   - **Structure**: `Summary` split when intent shifts (content vs. context); `Changes` organized into work groups derived from first principles (never line/file/commit/slice-based) with one-clause bullets; `Testing` present and specific; `Notes` only if there is something to flag.
9. If the title no longer summarizes the changeset, rewrite it (concise, imperative, matching repo convention such as Conventional Commits when in use).
10. Preserve still-relevant links/issues/related PR refs, including current screenshot/clip attachments.
11. Update the PR title (only if drifted) and body via `gh`, then verify by re-reading the PR.

## Template

Use this fixed section set. Omit optional sections when they add nothing.

```markdown
## Summary
<BLUF: 1-2 sentences stating what the change does (and its purpose only if not obvious). Bottom line first — no rationale, no build-up. If there is surrounding context (stack position, related PRs, review guidance), put it in its own following paragraph, after the bottom line.>

## Changes
### <Group / area>
- <one clause stating a change, not why>

### <Another group / area>
- <one clause stating a change, not why>

## Testing
<How it was verified: tests added/updated, manual steps, env, edge cases. Specific, not verbose.>

## Notes (optional)
<Tradeoffs, risks, breaking changes, known limitations, follow-ups, open questions.>

## Screenshots (optional)
<Before/after or current-state attachments for UI changes.>
```

## Length

Be terse (see the `terse` skill). Treat the word counts as ceilings, not targets, and come in under them; the shortest description that lets a reviewer navigate the diff wins.

- Trivial fix / typo: up to ~50 words. `Summary` + `Testing` often suffice.
- Single feature or refactor: up to ~150 words.
- Multi-component change: up to ~300 words.
- Breaking change or migration: up to ~400 words plus a migration/impact note in `Notes`.

## Guidelines

- Be terse. State what changed, not why it was done that way; omit rationale, justification, and design narration by default.
- Cap sentences and bullets at ~25 words. Split anything longer; prefer several short sentences over one clause-stacked line.
- Write BLUF (Bottom Line Up Front): put the main point at the very start, then follow with context. Present conclusions before the material that justifies them (deductive, not inductive); never open with background, motivation, or a chronology that builds toward the point.
- Lead with a one-to-two sentence `Summary` so a scanning reviewer gets bearings instantly; start it with an active verb. State the change and, if not obvious, its purpose in a single clause — no supporting argument.
- Apply BLUF fractally: each `Changes` group and each bullet also states its bottom line first, so a reviewer skimming only the lead of each section still gets the full picture.
- Split the `Summary` into paragraphs when intent shifts (change content vs. surrounding context); never fold related-PR/stack framing into the opening sentence.
- In `Changes`, derive the work groups from first principles: consider the whole changeset holistically and organize by cohesive units of work (behavior, capability, or area), not by how the change was produced. Each bullet states a fact in one clause. Keep bullets few. Do not explain why a change was made unless a reviewer cannot trust or navigate the change without it — and then in one clause, not a paragraph.
- Never structure the body line by line, file by file, commit by commit, or slice by slice. A commit list, changelog, or one-bullet-per-file dump is not an acceptable `Changes` structure; synthesize the diff into work groups instead.
- Do not structure content by implementation order or the sequence in which the work was done.
- Surface tradeoffs, risks, breaking changes, and known limitations in `Notes` rather than burying them mid-body; omit `Notes` when there is nothing to flag.
- `Testing` is required. Be specific about what was verified (tests, manual steps, env, edge cases); avoid bare "tested locally" and avoid verbosity.
- Do not write from commit messages alone; use the diff.
- Do not credit agents (Claude Code, Codex, etc.) for writing the description.
- Do not reference filepaths in the summary.
- Do not reference uncommitted plan files.
- Screenshots/clips belong as PR attachments, never committed to the repo; delegate their capture and refresh to `pr-screenshots`.

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
