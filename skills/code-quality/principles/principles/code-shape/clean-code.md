---
id: clean-code
category: Code Shape
category_id: code-shape
priority_level: 7
---

# Clean Code

## What It Means

Use meaningful names, focused methods, and clear structure so the code communicates intent with low cognitive load.

## Apply When

- Refactoring for readability after behavior is stable.
- Reviewing naming and method boundaries in changed scope.

## Good vs Bad

- Good: naming and decomposition make business intent obvious.
- Bad: cosmetically clean code that still hides unnecessary complexity.

## Tradeoffs and Conflicts

- Can conflict with `make-it-work` under urgent delivery pressure.
- Tie-break default: preserve correctness first, then improve readability in constrained increments.

## Actionable Playbook

- Rename unclear identifiers to expose domain intent before adding new logic.
- Keep functions focused: one responsibility, minimal branching, explicit inputs/outputs.
- Replace comments that explain "what" with code that makes intent obvious.
- With every change, improve one local readability issue (name, extraction, dead code, test).

## References

- Robert C. Martin, *Clean Code*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
