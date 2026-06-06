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

- Verify domain decisions stay pure while IO/framework/transport details sit in adapters.
- Check boundary clarity (domain, application, infrastructure) and import direction.
- Flag units mixing orchestration, validation, persistence, and formatting responsibilities.
- Require boundary tests that validate business rules independently from external systems.

## References

- David Parnas, modular decomposition papers
