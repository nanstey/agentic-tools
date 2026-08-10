---
name: deep-review
description: Runs an aggressively strict maintainability review focused on abstraction and complexity risk. Use when a harsh deep quality audit is requested.
disable-model-invocation: true
---

# Deep Review

Run an aggressive maintainability review focused on structural simplification.

## Scope and diff integrity

Resolve the review comparison via `changes` (diff-base protocol) before reviewing, and tie every finding to that comparison. Keep committed PR changes separate from working-tree changes.

## Review Priorities

1. Prefer designs that delete complexity, not move it.
2. Treat new spaghetti branching and ad-hoc flags as design problems.
3. Flag file-size explosions (especially crossing ~1000 lines) unless justified.
4. Push logic toward the appropriate layer and reuse existing helpers.
5. Prefer explicit type/boundary contracts over cast-heavy or optionality-heavy flow.
6. Call out unnecessary indirection, wrappers, and magic abstractions.
7. Prefer simpler, more atomic orchestration when obvious.

## Core Questions

- Is there a clear "code judo" simplification that removes branches/helpers/layers?
- Did this change make the module easier or harder to reason about?
- Is logic placed in the right layer with the right abstraction boundary?
- Did the diff add avoidable conditionals, casts, or duplicated logic?
- Is decomposition needed before accepting the current shape?

## Output Expectations

- Lead with highest-severity structural findings.
- Use concrete evidence and actionable remedies.
- Prefer a few high-conviction findings over many cosmetic notes.
- Treat major structural regressions as blockers unless justified.