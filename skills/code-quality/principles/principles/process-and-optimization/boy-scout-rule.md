---
id: boy-scout-rule
category: Process and Optimization
category_id: process-and-optimization
priority_level: 11
---

# Boy Scout Rule

## What It Means

Leave touched code a little cleaner than you found it, without turning every task into a broad refactor.

## Apply When

- You can make small local readability or safety improvements while delivering a planned change.
- A small cleanup reduces immediate maintenance risk.

## Good vs Bad

- Good: tighten names, remove dead branches, add focused tests in changed scope.
- Bad: expand scope into sweeping cleanup that threatens delivery.

## Tradeoffs and Conflicts

- Can conflict with `be-consistent` and `make-it-work`.
- Tie-break default: keep cleanup incremental; if cleanup changes delivery scope, defer and document.

## Actionable Playbook

- Verify touched scope includes at least one safe improvement beyond strict task minimum.
- Prefer low-risk cleanups: names, dead code removal, tiny extraction, or missing tests.
- Confirm cleanup stays local to changed area; flag broad refactors inside feature PRs.
- If deeper cleanup is needed, require a separate tracked follow-up task.

## References

- Robert C. Martin
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
