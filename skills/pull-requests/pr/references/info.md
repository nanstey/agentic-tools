# PR Info

## Core Contract

Resolve one PR for the current branch (or provided URL/number) and return core metadata.
This skill is read-only and is the front-door step for `/pr *` workflows.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL/number if provided.
2. Otherwise current branch.

## Workflow

1. If PR is provided, load it with `gh pr view <id> --json number,title,body,url,headRefName,headRefOid,baseRefName,baseRefOid,state,isDraft,author,mergeStateStatus`.
2. Otherwise resolve from branch using the same `gh pr view --json ...` query, then fallback `gh pr list --head <branch>` and fetch the selected PR with that query.
3. Verify `headRefName` matches current branch.
4. Return `number,title,body,url,headRefName,headRefOid,baseRefName,baseRefOid,state,isDraft,author,mergeStateStatus`.
5. Also fetch the stack membership via `gh api repos/{owner}/{repo}/pulls/{number} --jq '.stack'`; when non-null, flag that the PR is a layer of a GitHub native stack (see `/pr stack`) and include number/size/position.

Stop as blocked if there is no PR, multiple matches, a branch mismatch, or the PR is closed/merged unexpectedly; report the candidates.

## Authoritative diff comparison

`baseRefOid`/`headRefOid` define the PR's true comparison; this skill owns that resolution for every `/pr *` consumer.

- Diff the PR with `git diff <baseRefOid>..<headRefOid>` (`git log`/`git diff --stat` likewise). Never substitute a local `develop`/`origin/develop` ref — those can be stale or unrelated to the PR base.
- Verify local `HEAD` equals `headRefOid` before diffing against `HEAD`; if they differ, report the checkout as stale/unpushed rather than presenting a local diff as the PR diff.
- Keep committed PR changes separate from working-tree changes (`git diff`, `git diff --staged`, untracked).

## Safety Rules

- Never assume the current branch has exactly one open PR; discover and verify it.
- Never return a PR whose head branch does not match the current branch without flagging it.
- Never edit code, git state, or the PR; this skill only reads and reports.
- If unexpected repository or branch state appears, stop as blocked and report the state.

## Output Style

Report resolution method, PR number/title/URL, head/base/state, and any blocker.
