---
id: principle-of-least-surprise
category: Delivery Foundations
category_id: delivery-foundations
priority_level: 3
---

# Principle of Least Surprise

## What It Means

Prefer designs and naming that match reader expectations. Familiar code is easier to review, debug, and evolve.

## Apply When

- Introducing custom conventions, DSL-like helpers, or unusual control flow.
- Naming APIs that will be reused across teams.

## Good vs Bad

- Good: predictable names, explicit side effects, conventional structure.
- Bad: surprising hidden work, clever shortcuts, or implicit behavior.

## Tradeoffs and Conflicts

- Can conflict with `kiss` when a simple local shortcut is globally surprising.
- In tie-breaks, prioritize reducing surprise first, then simplify without hiding behavior.

## Actionable Playbook

- Use names that match existing domain and language conventions in the repository.
- Make side effects explicit in method names, docs, and call sites.
- Avoid hidden defaults that change behavior; prefer explicit parameters.
- In review, ask a teammate unfamiliar with the code to predict behavior from names alone.

## References

- Principle of Least Astonishment
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
