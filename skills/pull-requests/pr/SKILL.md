---
name: pr
description: Runs the full PR checklist by chaining the pr-* skills in a logical order. Use when a branch should be taken end-to-end to a healthy, review-ready PR.
user-invocable: true
disable-model-invocation: false
---

# PR

## Core Contract

Orchestrate the `pr-*` skills as one checklist for the current branch; do no PR work directly outside those skills.
Each step follows its own skill's contract and safety rules.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch (or PR URL/number).
2. Optional steps to skip.

## Workflow

Run in order, skipping steps the user excluded.

### 0. Pre-check
  - Run `changes` first to resolve the comparison scope and record the exact base/head refs. If a PR already exists, it must use GitHub's `baseRefOid..headRefOid`; never infer the PR base from local `develop` or `origin/develop`.
  - IF uncommitted `changes`:
    - IF on main/develop: create a new `branch`, and `commit`, then proceed to step 2b.
    - ELSE: `commit`

### 1. Check for existing PR status
  - `pr-info`: resolve and verify the PR.

### 2a. If PR exists, check comments and CI
  - `pr-comments`: apply fixes for unresolved threads locally; instruct it to **defer push and thread replies**.
  - `pr-ci`: diagnose existing failed CI jobs and apply fixes locally; instruct it to **defer push**.

### 2b. If PR doesn't exist, create one
  - `pr-create`: create a new PR.

### 3. Update the PR
  - `pr-rebase`: rebase onto the latest base and force-push with lease. This single push carries all fixes and triggers one fresh CI run and review-agent pass.
  - `pr-description`: sync the PR body with the final changeset using the verified GitHub `baseRefOid..headRefOid` comparison; for UI changesets it runs `pr-screenshots` to refresh visual evidence and attach it to the PR (never committed). Capturing this evidence is mandatory for UI changesets — never downgrade it to an optional decision or ask/skip because auth, feature flags, or navigation look involved (`visual-capture`/`playwright-cli` handle those). Stop only on `pr-screenshots`' own gates: site unreachable, ambiguous before/after refs, capture tooling unavailable, or an artifact would land in the repo.

After each step, report its outcome before continuing.
Stop and ask when any step hits its own stop gate, fails, or leaves the branch in an unexpected state.

## Safety Rules

- Never push during step 3; the rebase push exists to avoid retriggering CI and review agents on intermediate states.
- Never resolve threads before their fix commit is pushed.
- Never commit screenshots/clips to the repo; `pr-screenshots` attaches them to the PR.
- Never ask whether to capture UI screenshots or skip them on effort/auth/complexity grounds; delegate to `pr-screenshots` and stop only on its defined gates.
- Never continue past a failed step without user approval.
- Never duplicate work a sub-skill owns; delegate instead of reimplementing.
- If unexpected working tree changes appear between steps, stop and ask the user how to proceed.

## Output Style

Report a per-step checklist (run/skipped/blocked with one-line outcome), final PR URL and state, and any unresolved blockers.
