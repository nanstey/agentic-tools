# Bug checks

Select by the code's effects. Each check is a question to answer from source, not a pattern to flag on sight.

## Boundaries and arithmetic

- Off-by-one in loops, slices, ranges, pagination, and inclusive/exclusive limits.
- Empty, single-element, maximum-size, and negative inputs.
- Integer overflow, truncating division, float equality, rounding, currency in floats.
- Unit mismatch (ms vs s, bytes vs bits, UTC vs local).

## Null, absence, and types

- Null, undefined, `None`, missing key, or empty collection reaching a dereference.
- Optional values assumed present after a check that does not cover every path.
- Implicit coercion, truthiness of `0`/`""`, loose equality, signed/unsigned mix.
- Wrong default argument, mutable default, shared reference copied by mistake.

## Control flow and logic

- Inverted or incomplete conditions, wrong operator precedence, `&&`/`||` mix-ups.
- Missing `break`/`return`, fall-through, unreachable branches, dead guards.
- Switch/enum cases not handled after a new variant was added.
- Loop that skips items when mutated, or never ends.

## Errors and cleanup

- Swallowed exceptions, ignored return values or error codes, empty catch.
- Error path that skips cleanup, rollback, unlock, or close.
- Partial failure leaving state half-written.
- Retry without idempotency, or retry that hides a permanent error.
- Wrong error propagated (lost cause, wrong type, misleading message the caller branches on).

## State and lifecycle

- Stale cache, stale closure, state not reset between runs or requests.
- Initialization order, use before init, double init, double free or close.
- Invariants broken by an early return or a new caller.
- Mutation of an input the caller still uses.

## Concurrency and ordering

- Check-then-act (TOCTOU), lost update, unsynchronized shared state.
- Missing `await`, unhandled promise, fire-and-forget with lost errors.
- Lock ordering, deadlock, lock held across a call that can block.
- Event, callback, or message ordering assumed but not guaranteed.
- Non-atomic read-modify-write on a database or file.

## Resources and performance defects

- Leaked handle, connection, listener, timer, goroutine, or subscription.
- Unbounded growth: queue, cache, log, accumulating list.
- N+1 query or accidental quadratic work on a hot path, only when the scale makes it a defect.

## Data and encoding

- Wrong serialization or schema mismatch, field renamed on one side only.
- Time zone, DST, leap, locale, and Unicode (length vs bytes, normalization, case folding).
- Path, separator, and line-ending assumptions across platforms.
- Sorting or comparison that is not a strict weak order, or relies on unstable order.

## Contracts and integration

- Caller and callee disagree on units, nullability, ownership, or error behavior.
- Changed signature, default, or return shape with an unchanged caller.
- Public API, config key, flag, or migration changed without matching consumers.
- Library used against its documented semantics or a deprecated, changed behavior.

## Tests and guards

- Deleted or weakened assertion, skipped test, or loosened guard in the change.
- Test that passes for the wrong reason (mock hides the bug, assertion never runs).
- Missing coverage for the changed branch. Support a finding with it, never raise one from it alone.
