---
id: separation-of-concerns
category: Design Principles
category_id: design-principles
priority_level: 7
---

# Separation of Concerns

## What It Means

Separate domain behavior from infrastructure concerns such as transport, storage, and UI.

## Apply When

- Tests are difficult because business logic depends on framework details.
- Side effects and decision logic are intertwined.

## Good vs Bad

- Good: pure decision-making core with adapters for IO.
- Bad: controllers or jobs embedding domain policy and external calls together.

## Tradeoffs and Conflicts

- Can conflict with `make-it-work` under urgent bug fixes.
- Tie-break default: preserve behavior now, then isolate concerns in targeted follow-ups.

## Actionable Playbook

- Keep domain decisions pure; push IO, framework, and transport details to adapters.
- Define clear boundaries (domain, application, infrastructure) and enforce import direction.
- Avoid mixing orchestration, validation, persistence, and formatting in one unit.
- Add boundary tests that validate business rules independently from external systems.

## References

- David Parnas, modular decomposition papers
