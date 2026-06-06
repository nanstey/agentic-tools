---
id: design-patterns-if-necessary
category: Process and Optimization
category_id: process-and-optimization
priority_level: 9
---

# Design Patterns (If Necessary)

## What It Means

Use design patterns to address recurring, concrete pain, not as default structure.

## Apply When

- A repeated design problem appears across multiple contexts.
- Existing simple code clearly shows strain that a known pattern resolves.

## Good vs Bad

- Good: introduce a pattern where it removes proven complexity.
- Bad: add patterns preemptively in otherwise simple code.

## Tradeoffs and Conflicts

- Often conflicts with `kiss` and `yagni`.
- Tie-break default: prefer simple code first; adopt pattern only after pain is observed.

## Actionable Playbook

- Name the specific recurring problem before naming a pattern.
- Prove repetition or fragility in at least two places before pattern extraction.
- Choose the smallest pattern shape that removes the pain point.
- Document the tradeoff and expected benefit in the PR for future maintainers.

## References

- Gamma et al., *Design Patterns*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
