---
name: split
description: Splits a large branch or PR into smaller, independently reviewable units by grouping changes and proposing parallel PRs or a stacked series. Use when a changeset is too big to review well and should be broken up.
user-invocable: true
disable-model-invocation: false
---

# Split

## Core Contract

Break one oversized branch/PR into a set of smaller, coherent, reviewable units.
Discovery is delegated to the `changes` skill; PR creation/restacking is delegated to `pr-create` and `pr-restack`.
Prefer parallel (orthogonal) PRs; use a stacked series only when changes truly depend on each other.
Always propose the split structure and get explicit approval before any history rewrite.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch and its base (default base: repo convention or `develop`).
2. Source scope: current branch, a named branch, or a PR/URL.
3. Preferred PR tool (default `gh`) and whether execution is wanted now or plan-only.
4. Any constraints on grouping (must-ship-together files, review-size target).

## Workflow

1. Load the changeset with `changes` to get logical groups and flagged/out-of-place items.
2. Read branch/PR intent (`git log --oneline <base>..HEAD`, PR metadata) to name the units.
3. Build a dependency map between groups: shared files, symbol/import edges, test-to-code links.
4. Classify each group as **orthogonal** (no dependency) or **dependent** (builds on another).
5. Draft the split proposal:
   - Orthogonal groups → **parallel PRs**, each branched from base.
   - Dependent groups → **stacked series** ordered base → leaf, each PR based on the prior.
   - Note any group too small/large and suggest merges or further splits.
6. Present the proposal (units, files/hunks, order, PR type, rationale) and **stop for approval**.
7. On approval, execute per unit: create branch from the correct base, move the relevant changes, commit, and open the PR via `pr-create`; keep stacks aligned with `pr-restack`.
8. Verify each unit builds on the intended base and report the resulting PR set.

Stop and ask if dependencies are ambiguous, a group cannot be cleanly separated, or the split would rewrite already-reviewed history.

## Safety Rules

- Never rewrite history, create branches, or move commits before the proposal is approved.
- Never split a dependent group into parallel PRs; broken intermediate states are not acceptable.
- Never delegate away the dependency analysis — grouping order is this skill's responsibility.
- Never drop or duplicate changes across units; every hunk from the source lands in exactly one unit.
- Never open PRs against the wrong base; verify each stacked PR targets its parent, not the trunk.
- If a secret or credential surfaces while partitioning, flag it and do not echo its value.

## Output Style

Report source scope and base, the proposed units (name, files/hunks, PR type, base, order), the dependency rationale, approval gate outcome, and—if executed—the created branches/PRs with bases.
