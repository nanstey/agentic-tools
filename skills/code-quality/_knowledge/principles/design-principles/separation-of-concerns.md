# Separation of Concerns

## Metadata

- `id`: `separation-of-concerns`
- `category`: `Design Principles` (`design-principles`)
- `source`: https://en.wikipedia.org/wiki/Separation_of_concerns
- `priority_level`: `7`

## What It Means

Separate domain behavior from infrastructure concerns such as transport, storage, and UI.

## Apply When

- Tests are difficult because business logic depends on framework details.
- Side effects and decision logic are intertwined.

## Good vs Bad

- Good: pure decision-making core with adapters for IO.
- Bad: controllers or jobs embedding domain policy and external calls together.

## Tradeoffs and Conflicts

- Can conflict with `make-it-work` under urgent bug fixes.
- Tie-break default: preserve behavior now, then isolate concerns in targeted follow-ups.

## References

- David Parnas, modular decomposition papers
