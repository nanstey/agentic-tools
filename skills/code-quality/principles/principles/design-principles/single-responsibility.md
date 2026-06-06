---
id: single-responsibility
category: Design Principles
category_id: design-principles
priority_level: 8
---

# Single Responsibility (SRP)

## What It Means

A unit of code should have one primary reason to change.

## Apply When

- A file mixes unrelated responsibilities such as domain logic, transport, and persistence.
- A class accumulates behavior owned by different stakeholders.

## Good vs Bad

- Good: focused module boundaries with cohesive responsibilities.
- Bad: god classes or handlers that coordinate everything.

## Tradeoffs and Conflicts

- Can conflict with `dry` when premature extraction creates weak ownership.
- Tie-break default: preserve cohesion first; deduplicate only when shared responsibility is real.

## Actionable Playbook

- Identify stakeholders for a module; if multiple unrelated groups drive changes, split it.
- Separate orchestration from business rules and infrastructure adapters.
- Keep public APIs aligned to one concept, not a mixed utility surface.
- Validate with commit history: files that always change together may share one responsibility.

## References

- Robert C. Martin, SOLID
