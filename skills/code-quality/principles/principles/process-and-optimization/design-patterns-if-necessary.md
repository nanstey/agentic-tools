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

- Require the recurring problem to be named before selecting a pattern.
- Ask for evidence of repetition or fragility in at least two places before pattern extraction.
- Prefer the smallest pattern shape that removes the proven pain point.
- Verify tradeoff and expected benefit are documented in plan/PR context.

## References

- Gamma et al., *Design Patterns*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
