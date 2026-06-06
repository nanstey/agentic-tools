---
id: yagni
category: Delivery Foundations
category_id: delivery-foundations
priority_level: 2
---

# YAGNI

## What It Means

Do not build capability before a real requirement exists. Keep extension points only where near-term change is likely.

## Apply When

- A design introduces speculative hooks for hypothetical use cases.
- A ticket expands from concrete acceptance criteria into future architecture.

## Good vs Bad

- Good: implement current behavior and leave clear seams for later extension.
- Bad: build plugin systems, toggles, or abstractions no active scenario uses.

## Tradeoffs and Conflicts

- Conflicts most often with `agile-practices` and `design-patterns-if-necessary`.
- Tie-break default: if work is speculative, `yagni` wins; if upcoming iteration is committed and imminent, allow minimal prep.

## Actionable Playbook

- Ask: "Which current ticket or signed-off roadmap item requires this now?"
- Reject abstractions that have zero active callers or no concrete near-term scenario.
- Keep seams lightweight (clear interfaces, TODO notes) instead of full frameworks.
- Promote speculative code only after repeated demand is observed in production work.

## References

- "Principle of Software Development Principles" (Bartosz Krajka, 2017)
- Kent Beck, *Extreme Programming Explained*
