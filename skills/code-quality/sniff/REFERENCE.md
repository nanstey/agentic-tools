# Sniff Hierarchy Reference

## Purpose

`sniff` uses the shared code-quality knowledge dataset instead of embedding
every smell inline in `SKILL.md`.

## Dataset Layout

- `skills/code-quality/_knowledge/smells/index.json`
  - canonical smell IDs
  - category grouping
  - path lookup for each smell file
  - related refactoring IDs
- `skills/code-quality/_knowledge/smells/<category>/<smell-id>.md`
  - signs and symptoms
  - reasons for the problem
  - treatment summary and techniques
  - payoff and performance notes
  - related refactorings

## Categories

- `bloaters`
- `object-orientation-abusers`
- `change-preventers`
- `dispensables`
- `couplers`

## Maintenance Workflow

1. Edit individual smell markdown files for content changes.
2. Keep `skills/code-quality/_knowledge/smells/index.json` in sync for
   new/renamed smell entries.
3. Prefer one-smell-at-a-time updates for reviewable diffs.

## Source Material

- https://refactoring.guru/refactoring/smells
- Individual smell pages (for example `https://refactoring.guru/smells/long-method`)
