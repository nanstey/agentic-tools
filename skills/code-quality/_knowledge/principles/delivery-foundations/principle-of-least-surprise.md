# Principle of Least Surprise

## Metadata

- `id`: `principle-of-least-surprise`
- `category`: `Delivery Foundations` (`delivery-foundations`)
- `source`: https://en.wikipedia.org/wiki/Principle_of_least_astonishment
- `priority_level`: `3`

## What It Means

Prefer designs and naming that match reader expectations. Familiar code is easier to review, debug, and evolve.

## Apply When

- Introducing custom conventions, DSL-like helpers, or unusual control flow.
- Naming APIs that will be reused across teams.

## Good vs Bad

- Good: predictable names, explicit side effects, conventional structure.
- Bad: surprising hidden work, clever shortcuts, or implicit behavior.

## Tradeoffs and Conflicts

- Can conflict with `kiss` when a simple local shortcut is globally surprising.
- In tie-breaks, prioritize reducing surprise first, then simplify without hiding behavior.

## References

- Principle of Least Astonishment
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
