---
name: pr-info
description: Finds the PR for the current branch (or URL), verifies it, and returns key metadata. Use when PR context is needed before PR work.
---

# PR Info

## Core Contract

Resolve one PR for the current branch (or provided URL/number) and return core metadata.
This skill is read-only and is the front-door step for `pr-*` workflows.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL/number if provided.
2. Otherwise current branch.

## Workflow

1. If PR is provided, load it with `gh pr view <id> --json ...`.
2. Otherwise resolve from branch using `gh pr view --json ...`, then fallback `gh pr list --head <branch>`.
3. Verify `headRefName` matches current branch.
4. Return `number,title,body,url,headRefName,baseRefName,state,isDraft,author,mergeStateStatus`.

Stop and ask if no PR, multiple matches, branch mismatch, or PR is closed/merged unexpectedly.

## Safety Rules

- Never assume the current branch has exactly one open PR — discover and verify it.
- Never return a PR whose head branch does not match the current branch without flagging it.
- Never edit code, git state, or the PR; this skill only reads and reports.
- If unexpected repository or branch state appears, stop and ask the user how to proceed.

## Output Style

Report resolution method, PR number/title/URL, head/base/state, and any gate that required a user decision.
