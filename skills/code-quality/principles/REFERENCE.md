# Principles Knowledge Reference

## Purpose

`principles` uses shared code-quality knowledge instead of embedding all
principle definitions inside `SKILL.md`.

Paths in this reference are relative to the skill directory
(`skills/code-quality/principles/`), not the target repository root.

## Dataset Layout

- `./principles/index.json`
  - canonical principle IDs and categories
  - path lookup for each principle markdown file
  - canonical evaluation order (`principles[]` array order)
  - `priority_level` as validation + conflict tie-break metadata
  - related principle links
- `./principles/<category>/<principle-id>.md`
  - what the principle means
  - when to apply it
  - good vs bad usage examples
  - conflict and tradeoff guidance
  - references

## Index Schema

`index.json` contains:

- `meta`
  - `version`
  - `source`
  - `notes`
- `categories[]`
  - `id`
  - `name`
  - `principles[]`
    - `id`
    - `name`
    - `path`
- `principles[]`
  - `id`
  - `name`
  - `category_id`
  - `path`
  - `source_url`
  - `priority_level` (lower value = higher precedence in conflicts)
  - `related_principles[]`
  - `aliases[]`

## Maintenance Workflow

1. Edit individual principle markdown files for content changes.
2. Keep `index.json` in sync for
   new/renamed principles and category placement.
3. Preserve stable, lowercase, hyphenated principle IDs.
4. Keep `principles[]` in the intended canonical order; do not rely on runtime sorting.
5. Prefer one-principle-at-a-time updates for reviewable diffs.

## Conflict Resolution Rule

- When selected principles conflict, prefer the lower `priority_level`.
- Record the deferred principle as a guardrail, not a discard.
- If resolving conflict changes scope/timeline/architecture, stop and ask first.

## Sources

- https://medium.com/@bartoszkrajka/principle-of-software-development-principles-f0143d6f405
- Existing baseline principles from `./principles/index.json`
