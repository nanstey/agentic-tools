---
id: composition-over-inheritance
category: Design Principles
category_id: design-principles
priority_level: 8
---

# Composition over Inheritance

## What It Means

Build behavior by composing focused collaborators instead of relying on deep inheritance trees.

## Apply When

- Subclass hierarchies become brittle and hard to test.
- Behavior variation is orthogonal and mixes poorly in inheritance.

## Good vs Bad

- Good: inject interchangeable collaborators with clear contracts.
- Bad: multi-level inheritance where base changes ripple unexpectedly.

## Tradeoffs and Conflicts

- Can conflict with `kiss` if composition introduces unnecessary indirection.
- Tie-break default: use the simplest shape that avoids known hierarchy brittleness.

## Actionable Playbook

- Approve inheritance only for stable "is-a" relationships with substitutable behavior.
- Prefer collaborator composition for cross-cutting or optional behavior.
- Verify dependencies are injected via interfaces where testing or runtime substitution matters.
- Flag deep hierarchies when base-class changes repeatedly break downstream code.

## References

- Gamma et al., *Design Patterns*
