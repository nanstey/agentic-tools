---
id: make-it-work
category: Delivery Foundations
category_id: delivery-foundations
priority_level: 1
---

# Make It Work

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

## Actionable Playbook

- Define the smallest acceptance criteria that proves user value end-to-end.
- Implement the thinnest working slice first (happy path + one key failure path).
- Add tests that lock behavior before any cleanup or optimization work.
- If a shortcut is taken, open a scoped follow-up task in the same area before merge.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
