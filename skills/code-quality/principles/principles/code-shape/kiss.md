---
id: kiss
category: Code Shape
category_id: code-shape
priority_level: 4
---

# KISS

## What It Means

Choose the simplest implementation that solves current requirements with acceptable safety and clarity.

## Apply When

- Proposing abstractions, frameworks, or generalized flows.
- Reviewing code with many moving parts for a small task.

## Good vs Bad

- Good: direct control flow, explicit state, minimal indirection.
- Bad: abstraction layers added before demonstrated need.

## Tradeoffs and Conflicts

- Common conflict: `kiss` vs `design-patterns-if-necessary`.
- Tie-break default: start simple; add patterns only when repeated pain is visible.

## Actionable Playbook

- Start with a direct implementation that a new teammate can explain in one pass.
- Limit indirection: avoid new abstractions until duplication or variation is proven.
- Prefer plain data flow and explicit branching over framework cleverness.
- Before merge, remove any layer that does not reduce measurable complexity.

## References

- KISS principle
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
