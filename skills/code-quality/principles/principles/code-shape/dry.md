---
id: dry
category: Code Shape
category_id: code-shape
priority_level: 6
---

# DRY

## What It Means

Keep shared behavior and rules in one authoritative place to reduce drift and duplicated edits.

## Apply When

- Similar logic repeats in multiple files and changes together.
- Bug fixes require touching equivalent code in many places.

## Good vs Bad

- Good: extract stable duplication with a clear owner and narrow API.
- Bad: force premature abstractions that hide important differences.

## Tradeoffs and Conflicts

- Common conflict: `dry` vs `kiss`.
- Tie-break default: do not abstract repetition until behavior has stabilized and shared intent is clear.

## Actionable Playbook

- Track repeated changes: if one rule change touches 3+ places, investigate abstraction.
- Extract shared logic only when invariants are truly identical and likely to stay aligned.
- Keep the abstraction narrowly scoped and named by business intent, not mechanics.
- Re-run original call sites after extraction to confirm behavior and readability both improved.

## References

- Hunt and Thomas, *The Pragmatic Programmer*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
