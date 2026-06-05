# KISS

## Metadata

- `id`: `kiss`
- `category`: `Code Shape` (`code-shape`)
- `source`: https://en.wikipedia.org/wiki/KISS_principle
- `priority_level`: `4`

## What It Means

Choose the simplest implementation that solves current requirements with acceptable safety and clarity.

## Apply When

- Proposing abstractions, frameworks, or generalized flows.
- Reviewing code with many moving parts for a small task.

## Good vs Bad

- Good: direct control flow, explicit state, minimal indirection.
- Bad: abstraction layers added before demonstrated need.

## Tradeoffs and Conflicts

- Common conflict: `kiss` vs `design-patterns-if-necessary`.
- Tie-break default: start simple; add patterns only when repeated pain is visible.

## References

- KISS principle
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
