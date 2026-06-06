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

- Verify the artifact demonstrates the smallest acceptance criteria that proves end-to-end user value.
- Confirm the proposed or implemented slice covers a happy path plus at least one key failure path.
- Check that behavior is locked with tests or explicit validation before cleanup/optimization claims.
- If a shortcut is taken, require a scoped follow-up task in the same area before approval.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
