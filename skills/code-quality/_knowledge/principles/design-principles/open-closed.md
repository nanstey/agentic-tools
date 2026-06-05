# Open/Closed Principle (OCP)

## Metadata

- `id`: `open-closed`
- `category`: `Design Principles` (`design-principles`)
- `source`: https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle
- `priority_level`: `8`

## What It Means

Core behavior should be open to extension but closed to risky edits in stable paths.

## Apply When

- New variants repeatedly require edits to the same shared branch logic.
- Feature growth causes switch-heavy orchestration.

## Good vs Bad

- Good: extend via strategy/policy interfaces in known variation points.
- Bad: repeated edits to brittle core flows for each new case.

## Tradeoffs and Conflicts

- Can conflict with `kiss` if abstraction is introduced before variation is proven.
- Tie-break default: introduce extension seams only after at least one real variation is visible.

## References

- Bertrand Meyer, *Object-Oriented Software Construction*
