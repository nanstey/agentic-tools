# Clean Code

## Metadata

- `id`: `clean-code`
- `category`: `Code Shape` (`code-shape`)
- `source`: https://www.oreilly.com/library/view/clean-code/9780136083238/
- `priority_level`: `7`

## What It Means

Use meaningful names, focused methods, and clear structure so the code communicates intent with low cognitive load.

## Apply When

- Refactoring for readability after behavior is stable.
- Reviewing naming and method boundaries in changed scope.

## Good vs Bad

- Good: naming and decomposition make business intent obvious.
- Bad: cosmetically clean code that still hides unnecessary complexity.

## Tradeoffs and Conflicts

- Can conflict with `make-it-work` under urgent delivery pressure.
- Tie-break default: preserve correctness first, then improve readability in constrained increments.

## References

- Robert C. Martin, *Clean Code*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
