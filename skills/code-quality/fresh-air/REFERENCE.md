# Fresh Air Reference

## Graph Schema

`_knowledge/maps/smell-to-technique.json` contains:

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

## Refresh Workflow

Regenerate map data:

```bash
python3 skills/code-quality/fresh-air/scripts/update-map.py
```

Write to an alternate path:

```bash
python3 skills/code-quality/fresh-air/scripts/update-map.py --output /tmp/smell-to-technique.json
```

## Notes

- The scraper normalizes relationship labels into stable edge types.
- If a relationship target is not yet in the index list, the script still
  records it as a technique node so edges are preserved.
