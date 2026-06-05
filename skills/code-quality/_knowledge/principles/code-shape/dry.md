# DRY

## Metadata

- `id`: `dry`
- `category`: `Code Shape` (`code-shape`)
- `source`: https://en.wikipedia.org/wiki/Don%27t_repeat_yourself
- `priority_level`: `6`

## What It Means

Keep shared behavior and rules in one authoritative place to reduce drift and duplicated edits.

## Apply When

- Similar logic repeats in multiple files and changes together.
- Bug fixes require touching equivalent code in many places.

## Good vs Bad

- Good: extract stable duplication with a clear owner and narrow API.
- Bad: force premature abstractions that hide important differences.

## Tradeoffs and Conflicts

- Common conflict: `dry` vs `kiss`.
- Tie-break default: do not abstract repetition until behavior has stabilized and shared intent is clear.

## References

- Hunt and Thomas, *The Pragmatic Programmer*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
