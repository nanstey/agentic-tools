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

Run in order, skipping steps the user excluded:

1. `pr-info`: resolve and verify the PR; if none exists, run `pr-create`.
2. `pr-rebase`: rebase onto the latest base and force-push with lease.
3. `pr-ci`: diagnose and fix failed CI jobs until green or blocked.
4. `pr-comments`: resolve unresolved review threads.
5. `pr-description`: sync the PR body with the final changeset.

After each step, report its outcome before continuing.
Stop and ask when any step hits its own stop gate, fails, or leaves the branch in an unexpected state.

## Safety Rules

- Never reorder destructive steps: rebase must complete before CI fixes and comment resolution.
- Never continue past a failed step without user approval.
- Never duplicate work a sub-skill owns; delegate instead of reimplementing.
- If unexpected working tree changes appear between steps, stop and ask the user how to proceed.

## Output Style

Report a per-step checklist (run/skipped/blocked with one-line outcome), final PR URL and state, and any unresolved blockers.
