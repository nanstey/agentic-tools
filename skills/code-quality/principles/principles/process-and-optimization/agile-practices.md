---
id: agile-practices
category: Process and Optimization
category_id: process-and-optimization
priority_level: 10
---

# Agile Practices

## What It Means

In code review, prefer changes that deliver a small, testable increment and keep future adjustments cheap.

## Apply When

- Reviewing PRs in areas with evolving or uncertain requirements.
- Deciding whether a change is appropriately scoped for one iteration.

## Good vs Bad

- Good: a PR ships one clear user or operational improvement with tests and a follow-up path.
- Bad: a PR bundles speculative abstractions or multiple roadmap steps without current evidence.

## Tradeoffs and Conflicts

- Can conflict with `yagni`, `dry`, and `open-closed` when "future-proofing" adds premature structure.
- Tie-break default: approve the smallest change that solves today's validated need and can be safely extended later.

## Actionable Playbook

- Ask: "What single outcome does this PR deliver now?" Request splitting if the answer includes multiple outcomes.
- Verify that behavior is testable in this PR or plan increment (automated tests or explicit manual verification steps).
- Flag speculative framework work unless there are concrete near-term consumers.
- Prefer vertical slices (API + domain + UI where needed) over layer-only churn with no user-visible outcome.
- Confirm quality budget is preserved: tests, reliability safeguards, and small refactors are included where risk is introduced.

## References

- Agile Manifesto
- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
