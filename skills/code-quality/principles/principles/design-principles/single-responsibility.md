# Single Responsibility (SRP)

## Metadata

- `id`: `single-responsibility`
- `category`: `Design Principles` (`design-principles`)
- `source`: https://en.wikipedia.org/wiki/Single-responsibility_principle
- `priority_level`: `8`

## What It Means

A unit of code should have one primary reason to change.

## Apply When

- A file mixes unrelated responsibilities such as domain logic, transport, and persistence.
- A class accumulates behavior owned by different stakeholders.

## Good vs Bad

- Good: focused module boundaries with cohesive responsibilities.
- Bad: god classes or handlers that coordinate everything.

## Tradeoffs and Conflicts

- Can conflict with `dry` when premature extraction creates weak ownership.
- Tie-break default: preserve cohesion first; deduplicate only when shared responsibility is real.

## References

- Robert C. Martin, SOLID
