---
name: conflicts
description: Resolves in-progress merge/rebase/cherry-pick/revert conflicts and continues the git operation. Use when a git operation stops on conflicts.
---

# Conflicts

## Core Contract

Resolve an already in-progress merge/rebase/cherry-pick/revert conflict.
Use branch intent plus upstream integration; never blindly choose one side.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Active operation type.
2. Branch intent from commits/PR/user goal.

## Workflow

1. Detect active operation (`git status`; operation marker files).
2. Capture branch intent from commits and PR context.
3. List conflicted paths (`git diff --name-only --diff-filter=U`).
4. Resolve each file by meaning, including add/add and delete/modify cases.
5. Remove markers, stage resolved files, and run quick sanity checks.
6. Continue operation with the correct `--continue` command; repeat until complete.
7. Report outcomes; do not push unless asked.

If no operation is active, report and stop. If a resolution is ambiguous, stop and ask.

## Safety Rules

- Never blindly accept one side; resolve by meaning and intent.
- Ask the user when a resolution is genuinely ambiguous after using available context.
- Never leave conflict markers in committed files.
- Only abort the operation if the user requests it.
- Do not push as part of this skill unless explicitly asked.
- If unexpected changes appear, stop and ask the user how to proceed.

## Output Style

Report operation type, resolved files and decisions, any user-decided ambiguity, validation run, and final operation state.
