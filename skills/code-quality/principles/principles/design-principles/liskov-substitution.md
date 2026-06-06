---
id: liskov-substitution
category: Design Principles
category_id: design-principles
priority_level: 8
---

# Liskov Substitution Principle (LSP)

## What It Means

Subtypes must be safely replaceable for their base type without breaking expected behavior.

## Apply When

- Inheritance or interface hierarchies are used in production code.
- A new subtype changes preconditions, return semantics, or error behavior.

## Good vs Bad

- Good: each implementation honors the same contract, invariants, and caller expectations.
- Bad: subtype special cases force callers to detect concrete types or add defensive branches.

## Tradeoffs and Conflicts

- Can conflict with `kiss` when deep type hierarchies are introduced for minor reuse.
- Tie-break default: prefer simpler composition unless substitution is a real requirement.

## Actionable Playbook

- Require explicit contract behavior: valid inputs, outputs, side effects, and failure modes.
- Verify subtypes do not strengthen preconditions or weaken postconditions.
- Check exception and nullability behavior is consistent across implementations.
- Prefer contract tests that run the same assertions against each implementation.

## References

- Barbara Liskov, "Data Abstraction and Hierarchy" (1987)
- https://en.wikipedia.org/wiki/Liskov_substitution_principle
