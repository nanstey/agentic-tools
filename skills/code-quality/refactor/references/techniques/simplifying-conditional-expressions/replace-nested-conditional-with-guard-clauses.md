# Replace Nested Conditional with Guard Clauses

## Metadata

- `id`: `replace-nested-conditional-with-guard-clauses`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/replace-nested-conditional-with-guard-clauses

## Problem

You have a group of nested conditionals and it’s hard to determine the normal flow of code execution.

## Solution

Isolate all special checks and edge cases into separate clauses and place them before the main checks.

## When To Apply

You have a group of nested conditionals and it’s hard to determine the normal flow of code execution. Spotting the “conditional from hell” is fairly easy.

## Why Refactor

Spotting the “conditional from hell” is fairly easy.

## How To Apply

- Isolate all guard clauses that lead to calling an exception or immediate return of a value from the method. Place these conditions at the beginning of the method.
- After rearrangement is complete and all tests are successfully completed, see whether you can use Consolidate Conditional Expression for guard clauses that lead to the same exceptions or returned values.

## Benefits

- Not captured yet.

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
