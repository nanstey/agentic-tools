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

- Verify the solution can be explained in one pass by a teammate new to the area.
- Flag new indirection unless duplication or variation is already demonstrated.
- Prefer plain data flow and explicit branching over framework cleverness when outcomes are equivalent.
- Require justification for every added layer; remove layers that do not reduce measurable complexity.

## References

- KISS principle
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
