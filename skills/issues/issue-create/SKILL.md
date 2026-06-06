---
name: issue-create
description: Creates GitHub issues with normalized fields, optional metadata, and verification. Use when opening an issue, including optional parent linking.
user-invocable: true
disable-model-invocation: false
---

# Issue Create

## Core Contract

Create a GitHub issue with validated fields and verified final state.
Use `gh` by default and infer repo from current remote unless provided.
If parent linking is requested, create and verify a real sub-issue relationship.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Target repository.
2. Title and body intent (derive from `pr-info` if missing).
3. Optional metadata (labels, assignees, milestone).
4. Optional parent issue reference.
5. Permission/access constraints.

## Workflow

1. Acquire context (user-provided first; fallback to `pr-info` derivation).
2. Resolve repo and permissions.
3. Normalize payload (title/body + valid optional metadata).
4. Create issue with `gh issue create`.
5. If parent is requested, resolve parent deterministically and create GraphQL sub-issue link.
6. Verify issue fields and parent linkage with API readback.

If context remains ambiguous, metadata cannot be mapped, or linking fails due to policy/access, stop and ask.

## Safety Rules

- Never create an issue without confirming minimally sufficient title/body intent.
- Never create a placeholder issue from empty context before running `pr-info`.
- Never claim parent linkage succeeded without API-level verification.
- Never silently downgrade to a text-only parent reference when real linkage fails.
- Never invent labels, assignees, milestones, or parent IDs; validate each explicitly.
- Never violate fallback parent ordering in matching fallback mode.
- Never use a best-branch fallback parent that has no child issues.
- Stop and ask on permission errors, ambiguous repository resolution, or parent mismatch.

## Output Style

Report created issue info, context source, applied/skipped metadata, parent selection and linkage result (if requested), verification checks, and any gates encountered.
