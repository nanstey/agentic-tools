# Introduce Assertion

## Metadata

- `id`: `introduce-assertion`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/introduce-assertion

## Problem

For a portion of code to work correctly, certain conditions or values must be true.

## Solution

Replace these assumptions with specific assertion checks.

## When To Apply

For a portion of code to work correctly, certain conditions or values must be true. Say that a portion of code assumes something about, for example, the current condition of an object or value of a parameter or local variable.

## Why Refactor

Say that a portion of code assumes something about, for example, the current condition of an object or value of a parameter or local variable.

## How To Apply

- Not captured yet.

## Benefits

- If an assumption isn’t true and the code therefore gives the wrong result, it’s better to stop execution before this causes fatal consequences and data corruption. This also means that you neglected to write a necessary test when devising ways to perform testing of the program.

## Tradeoffs

- Validate scope and behavior preservation before broad changes.
- Prefer incremental commits for risky transformations.

## Validation Checks

- Existing tests pass (or equivalent behavioral verification).
- Readability/complexity is improved in touched scope.
- Follow-on refactors are explicitly called out, not implied.

## Relationships

### Anti Refactoring

- None.

### Similar Refactoring

- None.

### Helps Refactoring

- None.

### Eliminates Smell

- None.
