# Fresh Air Reference

## Graph Schema

`./technique-map/smell-to-technique.json` contains:

- `meta`
  - `generated_at`
  - `generator`
  - `source_root`
  - `source_pages`
- `families[]`
  - `id`
  - `name`
  - `url`
  - `description`
  - `technique_ids[]`
- `techniques[]`
  - `id`
  - `name`
  - `url`
  - `family_id`
- `smells[]`
  - `id`
  - `name`
- `edges[]`
  - `from`
  - `to`
  - `type` (`belongs_to_family`, `anti_refactoring`, `similar_refactoring`,
    `helps_refactoring`, `eliminates_smell`)
  - `source_url`

## Local Dataset Layout

- `./smells/index.json` for canonical smell ID validation.
- Candidate techniques come from each smell entry's `related_refactorings`.
- `./technique-map/smell-to-technique.json` for relationship graph edges.
- `./techniques/index.json` for technique metadata lookup.
- `./techniques/<category>/<technique-id>.md` for deep technique guidance used
  during final ranking.

## Refresh Workflow

When updating data manually, sync local map + technique datasets:

```bash
cp skills/code-quality/_knowledge/maps/smell-to-technique.json skills/code-quality/fresh-air/technique-map/smell-to-technique.json
cp skills/code-quality/_knowledge/refactor-techniques/index.json skills/code-quality/fresh-air/techniques/index.json
cp -R skills/code-quality/_knowledge/refactor-techniques/techniques/* skills/code-quality/fresh-air/techniques/
```

## Notes

- Use map edges to shortlist candidates, then use technique markdown files for
  tradeoffs and implementation guidance.
