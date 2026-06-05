# Refactor Reference

## Purpose

`refactor` orchestrates the refactor-planning flow and relies on the shared
knowledge layer at `skills/code-quality/_knowledge/`. It complements
`fresh-air`:

- `fresh-air`: choose *which* technique to apply for one smell finding.
- `refactor`: aggregate recommendations and hand off final plan writing to
  `dev/speclist`.

## Dataset Layout

- `_knowledge/refactor-techniques/index.json` — canonical lookup table:
  - categories
  - techniques
  - technique file paths
  - related IDs (`anti_refactoring`, `similar_refactoring`,
    `helps_refactoring`, `eliminates_smell`)
- `_knowledge/refactor-techniques/techniques/<category>/<technique-id>.md` —
  full details per technique:
  - problem
  - solution
  - when to apply
  - why refactor
  - how to apply
  - benefits
  - tradeoffs
  - validation checks
  - relationships
  - source link

## Index Schema

- `meta`
  - `version`
  - `generated_from`
- `categories[]`
  - `id`
  - `name`
  - `description`
  - `techniques[]` (`id`, `name`, `path`)
- `techniques[]`
  - `id`
  - `name`
  - `category_id`
  - `path`
  - `aliases[]`
  - `source_url`
  - `related`
    - `anti_refactoring[]`
    - `similar_refactoring[]`
    - `helps_refactoring[]`
    - `eliminates_smell[]`

## Maintenance Workflow

1. Edit individual technique files under
   `_knowledge/refactor-techniques/techniques/<category>/`.
2. Keep `_knowledge/refactor-techniques/index.json` in sync for
   new/renamed techniques and relationships.
3. Prefer one-technique-at-a-time updates for clean review diffs.

## Notes

- This repo treats the hierarchy as curated static content, not a live scraper output.
- When adding new techniques, keep IDs/paths stable to avoid breaking
  `fresh-air` lookups.
