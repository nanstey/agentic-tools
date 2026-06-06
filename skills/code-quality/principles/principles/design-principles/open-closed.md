---
id: open-closed
category: Design Principles
category_id: design-principles
priority_level: 8
---

# Open/Closed Principle (OCP)

## What It Means

Core behavior should be open to extension but closed to risky edits in stable paths.

## Apply When

- New variants repeatedly require edits to the same shared branch logic.
- Feature growth causes switch-heavy orchestration.

## Good vs Bad

- Good: extend via strategy/policy interfaces in known variation points.
- Bad: repeated edits to brittle core flows for each new case.

## Tradeoffs and Conflicts

- Can conflict with `kiss` if abstraction is introduced before variation is proven.
- Tie-break default: introduce extension seams only after at least one real variation is visible.

## Actionable Playbook

- Locate unstable variation points (provider differences, policy rules, channel-specific behavior).
- Verify variation is isolated behind small, behavior-focused contracts.
- Prefer extension through new strategy/policy implementations over repeated edits to core dispatch.
- Require tests that show existing implementations remain unchanged when adding variants.

## References

- Bertrand Meyer, *Object-Oriented Software Construction*
