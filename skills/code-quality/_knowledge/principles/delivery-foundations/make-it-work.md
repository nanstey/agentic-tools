# Make It Work

## Metadata

- `id`: `make-it-work`
- `category`: `Delivery Foundations` (`delivery-foundations`)
- `source`: https://medium.com/@bartoszkrajka/principle-of-software-development-principles-f0143d6f405
- `priority_level`: `1`

## What It Means

Ship correct behavior first. All quality and design improvements depend on having working behavior to preserve.

## Apply When

- The team is debating polish versus basic correctness.
- A refactor risks delaying a working user flow.

## Good vs Bad

- Good: implement a minimal, testable path that satisfies today's acceptance criteria.
- Bad: produce elegant architecture that still fails core scenarios.

## Tradeoffs and Conflicts

- Usually wins against `make-it-fast` and `boy-scout-rule` when deadlines are tight.
- Guardrail: avoid hacks that block follow-up cleanup in the same area.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
