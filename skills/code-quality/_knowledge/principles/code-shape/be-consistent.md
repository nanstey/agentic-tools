# Be Consistent

## Metadata

- `id`: `be-consistent`
- `category`: `Code Shape` (`code-shape`)
- `source`: https://medium.com/@bartoszkrajka/principle-of-software-development-principles-f0143d6f405
- `priority_level`: `5`

## What It Means

Use consistent conventions in naming, structure, and patterns so code is easier to scan and maintain.

## Apply When

- Touching modules with established style and architecture patterns.
- Choosing between equivalent implementations.

## Good vs Bad

- Good: follow local conventions unless they meaningfully harm readability or simplicity.
- Bad: oscillate style in nearby files or force ecosystem idioms that reduce clarity.

## Tradeoffs and Conflicts

- Can conflict with `boy-scout-rule` during cleanup.
- Tie-break default: keep consistency unless a targeted change materially improves clarity and does not broaden scope.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
