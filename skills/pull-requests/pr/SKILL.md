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
Batch all local work before the first push so CI and review agents trigger once, not per step:

1. `pr-info`: resolve and verify the PR; if none exists, run `pr-create`.
2. `pr-rebase`: rebase onto the latest base locally; instruct it to **defer the force-push**.
3. `pr-comments` (fix pass): apply fixes for unresolved threads locally; instruct it to **defer push and thread replies**.
4. Push once with `--force-with-lease`. This triggers a single fresh CI run and review-agent pass.
5. `pr-ci`: wait for the fresh run, then diagnose and fix failed jobs until green or blocked (its fix loop may push again).
6. `pr-comments` (follow-up pass): reply to and resolve the threads fixed in step 3, and triage any new comments from the retriggered review agent.
7. `pr-description`: sync the PR body with the final changeset.

After each step, report its outcome before continuing.
Stop and ask when any step hits its own stop gate, fails, or leaves the branch in an unexpected state.

## Safety Rules

- Never reorder destructive steps: rebase must complete before CI fixes and comment resolution.
- Never push between steps 2-3; deferred pushes exist to avoid retriggering CI and review agents on intermediate states.
- Never resolve threads before their fix commit is pushed.
- Never continue past a failed step without user approval.
- Never duplicate work a sub-skill owns; delegate instead of reimplementing.
- If unexpected working tree changes appear between steps, stop and ask the user how to proceed.

## Output Style

Report a per-step checklist (run/skipped/blocked with one-line outcome), final PR URL and state, and any unresolved blockers.
