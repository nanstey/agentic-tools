---
id: interface-segregation
category: Design Principles
category_id: design-principles
priority_level: 8
---

# Interface Segregation Principle (ISP)

## What It Means

Clients should depend only on the smallest interface that matches what they actually use.

## Apply When

- Interfaces accumulate unrelated methods for different consumers.
- Implementations include placeholder methods, no-op behavior, or unsupported-operation errors.

## Good vs Bad

- Good: focused interfaces with cohesive method sets per use case.
- Bad: broad "god interfaces" that force consumers to depend on irrelevant behavior.

## Tradeoffs and Conflicts

- Can conflict with `dry` if over-splitting creates needless duplication across tiny interfaces.
- Tie-break default: optimize for consumer clarity, then extract shared contracts when reuse is real.

## Actionable Playbook

- Verify methods are grouped by consumer workflow rather than storage or technical layer.
- Flag wide contracts and favor role-based interfaces with clear ownership.
- Check high-level dependencies are typed to the smallest required interface.
- Treat no-op or unsupported-operation implementations as strong evidence for segregation.

## References

- Robert C. Martin, SOLID
- https://en.wikipedia.org/wiki/Interface_segregation_principle
