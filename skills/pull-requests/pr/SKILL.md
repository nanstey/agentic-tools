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
Fix everything against the already-pushed state, then push once at the end so CI and review agents retrigger a single time:

1. `pr-info`: resolve and verify the PR.
2. `pr-create`: if no PR exists, create one.
3. `pr-ci`: diagnose existing failed CI jobs and apply fixes locally; instruct it to **defer push**.
4. `pr-comments`: apply fixes for unresolved threads locally; instruct it to **defer push and thread replies**.
5. `pr-rebase`: rebase onto the latest base and force-push with lease. This single push carries all fixes and triggers one fresh CI run and review-agent pass.
6. Follow up: confirm the fresh CI run is green (loop back to `pr-ci` if not), then reply to and resolve the threads fixed in step 4.
7. `pr-description`: sync the PR body with the final changeset.

After each step, report its outcome before continuing.
Stop and ask when any step hits its own stop gate, fails, or leaves the branch in an unexpected state.

## Safety Rules

- Never push during steps 3-4; the rebase push exists to avoid retriggering CI and review agents on intermediate states.
- Never resolve threads before their fix commit is pushed.
- Never continue past a failed step without user approval.
- Never duplicate work a sub-skill owns; delegate instead of reimplementing.
- If unexpected working tree changes appear between steps, stop and ask the user how to proceed.

## Output Style

Report a per-step checklist (run/skipped/blocked with one-line outcome), final PR URL and state, and any unresolved blockers.
