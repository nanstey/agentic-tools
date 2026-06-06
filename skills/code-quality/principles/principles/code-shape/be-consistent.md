---
id: be-consistent
category: Code Shape
category_id: code-shape
priority_level: 5
---

# Be Consistent

## What It Means

Use consistent conventions in naming, structure, and patterns so code is easier to scan and maintain.

## Apply When

- Touching modules with established style and architecture patterns.
- Choosing between equivalent implementations.

## Good vs Bad

- Good: follow local conventions unless they meaningfully harm readability or simplicity.
- Bad: oscillate style in nearby files or force ecosystem idioms that reduce clarity.

## Tradeoffs and Conflicts

- Can conflict with `boy-scout-rule` during cleanup.
- Tie-break default: keep consistency unless a targeted change materially improves clarity and does not broaden scope.

## Actionable Playbook

- Match existing local conventions for naming, file layout, and error handling first.
- If introducing a new convention, apply it consistently in the touched scope only.
- Use formatters and linters as the source of truth for style-level decisions.
- Document intentional deviations in the PR description with rationale.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
