# Consolidate Duplicate Conditional Fragments

## Metadata

- `id`: `consolidate-duplicate-conditional-fragments`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/consolidate-duplicate-conditional-fragments

## Problem

Identical code can be found in all branches of a conditional.

## Solution

Move the code outside of the conditional.

## When To Apply

Identical code can be found in all branches of a conditional. Duplicate code is found inside all branches of a conditional, often as the result of evolution of the code within the conditional branches.

## Why Refactor

Duplicate code is found inside all branches of a conditional, often as the result of evolution of the code within the conditional branches.

## How To Apply

- If the duplicated code is at the beginning of the conditional branches, move the code to a place before the conditional.
- If the code is executed at the end of the branches, place it after the conditional.
- If the duplicate code is randomly situated inside the branches, first try to move the code to the beginning or end of the branch, depending on whether it changes the result of the subsequent code.
- If appropriate and the duplicate code is longer than one line, try using Extract Method .

## Benefits

- Code deduplication.

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
