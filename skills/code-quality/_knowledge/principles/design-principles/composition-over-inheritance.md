# Composition over Inheritance

## Metadata

- `id`: `composition-over-inheritance`
- `category`: `Design Principles` (`design-principles`)
- `source`: https://en.wikipedia.org/wiki/Composition_over_inheritance
- `priority_level`: `8`

## What It Means

Build behavior by composing focused collaborators instead of relying on deep inheritance trees.

## Apply When

- Subclass hierarchies become brittle and hard to test.
- Behavior variation is orthogonal and mixes poorly in inheritance.

## Good vs Bad

- Good: inject interchangeable collaborators with clear contracts.
- Bad: multi-level inheritance where base changes ripple unexpectedly.

## Tradeoffs and Conflicts

- Can conflict with `kiss` if composition introduces unnecessary indirection.
- Tie-break default: use the simplest shape that avoids known hierarchy brittleness.

## References

- Gamma et al., *Design Patterns*
