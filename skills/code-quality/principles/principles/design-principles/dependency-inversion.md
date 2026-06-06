---
id: dependency-inversion
category: Design Principles
category_id: design-principles
priority_level: 8
---

# Dependency Inversion Principle (DIP)

## What It Means

High-level policy should depend on abstractions, while concrete details depend on those abstractions.

## Apply When

- Core business logic imports infrastructure details directly (DB, HTTP clients, frameworks).
- Swapping implementations requires edits in high-level orchestration code.

## Good vs Bad

- Good: use ports/interfaces for policy boundaries and inject infrastructure adapters.
- Bad: business logic hard-codes concrete providers and lifecycle details.

## Tradeoffs and Conflicts

- Can conflict with `yagni` when abstractions are created before any plausible variation exists.
- Tie-break default: add abstraction at stable boundaries that already cause coupling pain.

## Actionable Playbook

- Verify high-level policy modules are isolated from transport and persistence details.
- Check abstractions (ports) are small, behavior-focused, and owned by the policy layer.
- Confirm concrete adapters are wired at composition boundaries, not inside policy logic.
- Look for tests that substitute adapters with fakes to validate policy logic independently.

## References

- Robert C. Martin, SOLID
- https://en.wikipedia.org/wiki/Dependency_inversion_principle
