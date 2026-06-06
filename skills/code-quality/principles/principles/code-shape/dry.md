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

- Check repeated-change evidence: if one rule change touches 3+ places, investigate abstraction.
- Approve extraction only when invariants are truly identical and likely to remain aligned.
- Verify abstractions are narrowly scoped and named by business intent, not mechanics.
- Confirm call sites still preserve behavior and readability after deduplication.

## References

- Hunt and Thomas, *The Pragmatic Programmer*
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
