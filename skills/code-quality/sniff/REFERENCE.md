# Sniff Hierarchy Reference

## Purpose

`sniff` uses a local smell dataset instead of embedding
every smell inline in `SKILL.md`.

## Dataset Layout

- `./smells/index.json`
  - reference smell IDs
  - category grouping
  - path lookup for each smell file
  - related refactoring IDs
- `./smells/<category>/<smell-id>.md`
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
2. Keep `./smells/index.json` in sync for
   new/renamed smell entries.
3. Prefer one-smell-at-a-time updates for reviewable diffs.

## Source Material

- https://refactoring.guru/refactoring/smells
- Individual smell pages (for example `https://refactoring.guru/smells/long-method`)
