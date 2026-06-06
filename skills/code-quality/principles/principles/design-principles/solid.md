---
id: solid
category: Design Principles
category_id: design-principles
priority_level: 8
---

# SOLID

## What It Means

Treat SOLID as a design-level quality set that supports extensibility, testability, and maintainability.

## Apply When

- Designing public module boundaries or medium/large feature architecture.
- Review identifies repeated rigidity in object collaboration.

## Good vs Bad

- Good: apply only the SOLID principles relevant to current constraints.
- Bad: force all five principles mechanically regardless of project context.

## Tradeoffs and Conflicts

- Can conflict with `yagni` and `kiss` when used as a reason for speculative architecture.
- Tie-break default: prefer simpler local solutions unless architecture pressure is already demonstrated.

## Actionable Playbook

- Use SRP when a module has multiple reasons to change; split by change axis.
- Use OCP when new variants repeatedly edit stable code; extract extension seams.
- Use LSP/ISP/DIP when polymorphism is already needed, not as upfront ceremony.
- In review, require a concrete maintenance pain that each SOLID-motivated change resolves.

## References

- Robert C. Martin, SOLID
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
