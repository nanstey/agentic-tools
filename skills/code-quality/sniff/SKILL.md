---
name: sniff
description: Runs structured code-smell analysis and maps findings to canonical smell categories. Use when prioritizing maintainability risks and refactors.
user-invocable: true
disable-model-invocation: false
---

# Sniff

## Core Contract

Run evidence-based code-smell review and map findings to canonical smell IDs.
Use `./smells/index.json` plus `./smells/<category>/<smell-id>.md`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Review scope.
2. Language/framework context.
3. Strictness level.
4. Canonical-only mode (default true).

## Workflow

1. Frame review goal and choose 2-4 priority smell categories.
2. Load canonical smell hierarchy and resolve IDs.
3. Produce evidence-backed findings with related refactor suggestions.
4. Rank severity (`high`/`medium`/`low`) and include one intentional non-finding.
5. Verify every finding maps to canonical ID and concrete code evidence.

Stop and ask before introducing custom smell labels or proposing out-of-scope architecture changes.

## Safety Rules

- Never label something a smell without evidence in the reviewed code.
- Never demand broad refactors when a localized fix addresses the risk.
- Never force category coverage; report only smells that actually appear.
- Never invent canonical smell IDs outside
  `./smells/index.json` without user approval.

## Output Style

Report scope, evaluated categories/smells, grouped findings with evidence and related refactors, severity-ranked top actions, and one intentional non-finding.
