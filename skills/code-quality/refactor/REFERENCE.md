# Refactor Reference

## Purpose

`refactor` orchestrates the refactor-planning flow and validates canonical
smell IDs from local datasets. It complements `fresh-air`:

- `fresh-air`: choose *which* technique to apply for one smell finding.
- `refactor`: aggregate recommendations and author the final implementation
  plan directly.

## Dataset Layout

- `./smells/index.json` — canonical smell lookup for validation:
  - canonical smell IDs
  - category grouping
  - per-smell paths
  - related refactoring IDs
- `./techniques/index.json` — compact technique lookup:
  - canonical technique IDs
  - names, families, and URLs
- `./technique-map/smell-to-technique.json` — relationship graph used for
  sequencing consistency checks across recommendations

## Validation and Fast Path Schema

- `meta`
  - `version`
  - `source`
- `smells[]`
  - `id`
  - `name`
  - `category_id`
  - `path`
  - `related_refactorings[]`

Fast-path entries supplied to `refactor` should include:

- canonical smell ID
- one concrete evidence location
- concrete constraints
- explicit technique recommendations (canonical IDs)

## Maintenance Workflow

1. Keep `./smells/index.json` synced with canonical smell IDs used by
   `sniff` and `fresh-air`.
2. Keep `./techniques/index.json` and `./technique-map/smell-to-technique.json`
   in sync with `fresh-air`.
3. Ensure fast-path validation checks reject non-canonical or underspecified
   entries.
4. Prefer one-smell-at-a-time updates for clean review diffs.

## Notes

- `refactor` uses lightweight technique metadata and mapping edges; it does not
  require technique markdown files.
- It uses `fresh-air` outputs or validated direct user context, then writes the
  final implementation plan itself.
