# Boy Scout Rule

## Metadata

- `id`: `boy-scout-rule`
- `category`: `Process and Optimization` (`process-and-optimization`)
- `source`: https://en.wikipedia.org/wiki/Boy_Scout_Rule_(software_development)
- `priority_level`: `11`

## What It Means

Leave touched code a little cleaner than you found it, without turning every task into a broad refactor.

## Apply When

- You can make small local readability or safety improvements while delivering a planned change.
- A small cleanup reduces immediate maintenance risk.

## Good vs Bad

- Good: tighten names, remove dead branches, add focused tests in changed scope.
- Bad: expand scope into sweeping cleanup that threatens delivery.

## Tradeoffs and Conflicts

- Can conflict with `be-consistent` and `make-it-work`.
- Tie-break default: keep cleanup incremental; if cleanup changes delivery scope, defer and document.

## References

- Robert C. Martin
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
