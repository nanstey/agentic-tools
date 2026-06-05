# Design Patterns (If Necessary)

## Metadata

- `id`: `design-patterns-if-necessary`
- `category`: `Process and Optimization` (`process-and-optimization`)
- `source`: https://medium.com/@bartoszkrajka/principle-of-software-development-principles-f0143d6f405
- `priority_level`: `9`

## What It Means

Use design patterns to address recurring, concrete pain, not as default structure.

## Apply When

- A repeated design problem appears across multiple contexts.
- Existing simple code clearly shows strain that a known pattern resolves.

## Good vs Bad

- Good: introduce a pattern where it removes proven complexity.
- Bad: add patterns preemptively in otherwise simple code.

## Tradeoffs and Conflicts

- Often conflicts with `kiss` and `yagni`.
- Tie-break default: prefer simple code first; adopt pattern only after pain is observed.

## References

- Gamma et al., *Design Patterns*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
