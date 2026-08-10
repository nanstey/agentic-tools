---
name: changes
description: Inspects staged and unstaged changes and groups them into coherent change sets. Use when reviewing what changed before committing.
---

# Changes

## Core Contract

Read-only change review: group current edits by intent and flag out-of-place items.
Always inspect real diffs and branch intent.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

This is the canonical skill for resolving review scope and diff bases. Never infer a
PR's base from local `develop`, `origin/develop`, or a similarly named ref.

### Diff-base protocol

- If a PR exists, resolve it through `pr-info` and use GitHub's exact
  `baseRefOid` as the base SHA. Review the PR's committed changes with
  `git diff <baseRefOid>..<headRefOid>` (or `<baseRefOid>..HEAD` only after
  verifying local `HEAD` equals the PR's `headRefOid`).
- If local `HEAD` differs from the PR head SHA, report that the checkout is
  stale or has unpushed commits; do not present a local diff as the PR diff.
- Keep committed PR changes separate from working-tree changes: inspect
  `git diff <headRefOid>` and `git diff --staged` as applicable, and classify
  untracked files separately.
- If no PR exists, use the explicitly requested target branch/ref. Otherwise
  resolve the repository's conventional target and record both the ref and its
  resolved SHA. A local branch name is only a candidate, never proof of the
  remote/PR base. Use a three-dot merge-base diff for this pre-PR case.
- Always report the exact base ref/SHA and head ref/SHA used, plus whether the
  comparison is a GitHub PR comparison or a pre-PR branch comparison.

## Required Inputs

1. Current branch and base.
2. Requested scope (all or paths).
3. Branch intent from history/name/PR.
4. Detail level (default: grouped breakdown).

## Workflow

1. Capture state with `git status --porcelain`, `git diff`, and `git diff --staged`.
2. Resolve PR metadata (including `baseRefOid` and `headRefOid`) via `pr-info`; if no PR exists, resolve and record the requested/conventional target ref and SHA.
3. Verify the local head before describing a PR diff, then inspect the exact comparison selected by the Diff-base protocol.
4. Read branch context with `git log --oneline <base>..<head>` and PR metadata.
5. Group changes by unit of work (feature/fix/refactor/test/docs), splitting hunks when needed.
6. Classify untracked files as relocation, net-new, or follow-on edits.
7. Flag unrelated/incidental/risky/inconsistent items with `file:line` references.
8. If there is no working-tree delta, report that separately; continue reviewing the committed PR/branch comparison when one exists. If both the working tree and selected committed comparison are clean, report and stop.

## Safety Rules

- Never stage, commit, push, amend, stash, reset, or discard. This skill only reads and reports.
- Never run `git add`, not even to inspect.
- Do not edit files to "clean up" what you flag; report it and let the user decide.
- If you spot a secret or credential, flag it prominently and do not echo its value in full.

## Output Style

Report branch/base, inferred purpose, logical groups, untracked classifications, flagged items with `file:line`, and whether splitting is recommended before commit.
