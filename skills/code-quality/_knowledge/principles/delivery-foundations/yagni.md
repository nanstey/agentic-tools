# YAGNI

## Metadata

- `id`: `yagni`
- `category`: `Delivery Foundations` (`delivery-foundations`)
- `source`: https://medium.com/@bartoszkrajka/principle-of-software-development-principles-f0143d6f405
- `priority_level`: `2`

## What It Means

Do not build capability before a real requirement exists. Keep extension points only where near-term change is likely.

## Apply When

- A design introduces speculative hooks for hypothetical use cases.
- A ticket expands from concrete acceptance criteria into future architecture.

## Good vs Bad

- Good: implement current behavior and leave clear seams for later extension.
- Bad: build plugin systems, toggles, or abstractions no active scenario uses.

## Tradeoffs and Conflicts

- Conflicts most often with `agile-practices` and `design-patterns-if-necessary`.
- Tie-break default: if work is speculative, `yagni` wins; if upcoming iteration is committed and imminent, allow minimal prep.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
- Kent Beck, *Extreme Programming Explained*
