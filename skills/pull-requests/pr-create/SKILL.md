---
name: pr-create
description: Creates a PR for the current branch or worktree when none exists. Use when a branch needs a pull request opened.
user-invocable: true
disable-model-invocation: false
---

# PR Create

## Core Contract

Create exactly one PR for the current branch against the correct base.
Default tool is `gh`. Default base is `develop`; PR opens as draft unless asked otherwise.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch with at least one commit ahead of base.
2. Base branch if non-default.
3. Draft vs ready preference (default draft).

## Workflow

1. Resolve PR state via `pr-info`; if a PR already exists, report it and stop.
2. Confirm the branch is pushed; push with `git push -u origin <branch>` if needed.
3. Determine base branch (explicit input > repo convention > `develop`).
4. Analyze `base...HEAD` diff (`git log`, `git diff --stat`, `git diff`) to draft title and body.
5. Write a concise body (typically `Summary`, `What Changed`, optional `Testing`/`Open Questions`); do not write from commit messages alone.
6. Create the PR with `gh pr create --draft --base <base> --title ... --body ...`.
7. Verify by re-reading the PR and report the URL.

Stop and ask if the branch has no commits ahead of base, the base is ambiguous, or push fails.

## Safety Rules

- Never create a second PR when one already exists for the branch.
- Never force-push or rewrite history; pushing the branch is the only allowed git mutation.
- Never base the description only on commit titles when the diff is available.
- Never mark the PR ready-for-review unless explicitly asked.
- If unexpected working tree changes appear while you are working, stop and ask the user how to proceed.

## Output Style

Report PR number/URL, base used, draft state, push performed or not, and any gate that required a user decision.
