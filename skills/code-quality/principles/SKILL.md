---
name: principles
description: Runs a prioritized principles check for non-trivial design, implementation, and review decisions.
user-invocable: true
disable-model-invocation: false
---

# Principles

## Core Contract

Run a short, evidence-based principles pass.
Use `principles/index.json` and per-principle markdown files.
Prefer practical outcomes over rigid rule-following.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Task type (`design`, `implement`, `review`).
2. Scope under change.
3. Constraints.
4. Likely principle conflicts.

## Workflow

1. Confirm scope (use `scope` if needed).
2. Define the decision and the main failure risk.
3. Load `principles/index.json`; use `principles[]` order as hierarchy.
   - `priority_level` must match that order.
4. Evaluate in hierarchy order.
   - Check foundational principles before advanced ones.
   - Report the first 3-5 materially relevant principles in order.
   - If a higher-priority principle fails, make lower-priority recommendations conditional.
5. Resolve conflicts by preserving higher-priority intent and recording exception guardrails.
6. Propose minimal remediations and explicit exceptions.

## Safety Rules

- Never apply principles mechanically when constraints require exceptions.
- Never add speculative abstractions solely to satisfy a principle.
- Never claim "best practice" without concrete context.
- Never invent out-of-list principle IDs or labels without explicit user approval.
- Never force broad refactors without user approval if local fixes are enough.

## Output Style

Use three sections:
1. Review Frame
  - Scope
  - What
  - Why
2. Principle Outcomes
   - Present 3-5 IDs in hierarchy order.
   - Prefix each item with: `✅` pass, `⚠️` warning, `❌` fail.
   - Include relevance and concise evidence for each.
3. Recommended Changes (highest impact first).
   - List concrete file paths.
   - For each file, state the specific change needed and why it addresses the principle finding.
   - Keep each item implementation-ready (no vague "improve/refactor" wording).
