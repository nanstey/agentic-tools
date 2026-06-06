---
name: check-skill-name
description: Checks proposed skill names for collisions with reserved or existing names. Use when validating a skill or command name before creation.
---

# Check Skill Name

## Core Contract

Validate skill/command names before creation to avoid collisions across harnesses and this repo.
`known-names.json` is the source of truth; only update it in explicit update mode.
Follow repo naming rules from `CLAUDE.md` / `AGENTS.md`.

## Required Inputs

1. Proposed name(s).
2. Mode: `check` (default) or `update`.
3. Current repo skill/agent names for in-repo collision checks.

## Workflow

### Check mode

1. Normalize candidate names (lowercase, strip `/`, basename only).
2. Load reserved names from `known-names.json` and in-repo names from frontmatter.
3. Classify each candidate:
   - `CONFLICT`: exact reserved/repo match.
   - `RISKY`: near-match or alias collision.
   - `CLEAR`: no collision.
4. For non-clear results, propose 3-5 safe alternatives.
5. Report verdict plus list `updated` date.

### Update mode

1. Read `sources` in `known-names.json`.
2. Fetch each source docs page and extract command/skill names.
3. Merge names conservatively (do not delete uncertain misses).
4. Rewrite `known-names.json` with merged names and new `updated` date.
5. Report per-source added/removed/unchanged and fetch failures.

## Safety Rules

- Never create the skill directory or any skill files — this skill only validates a name. Creating the skill is a separate step the user takes after a clear verdict.
- The only file this skill may write is `known-names.json`, and only in update mode. Do not edit it during a check.
- In update mode, never blank out a source on a failed fetch — leave its existing names intact and report the failure.
- Do not invent names as "reserved" without a source; every reserved name traces to `known-names.json`.

## Output Style

For `check`: normalized name, verdict (`CLEAR`/`CONFLICT`/`RISKY`), owning sources, safe alternatives when needed, and `updated` date.
For `update`: per-source add/remove/unchanged counts, new `updated` date, and any failed refreshes.
