# Inline Temp

## Metadata

- `id`: `inline-temp`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/inline-temp

## Problem

You have a temporary variable that’s assigned the result of a simple expression and nothing more.

## Solution

Replace the references to the variable with the expression itself.

## When To Apply

You have a temporary variable that’s assigned the result of a simple expression and nothing more. Inline local variables are almost always used as part of Replace Temp with Query or to pave the way for Extract Method .

## Why Refactor

Inline local variables are almost always used as part of Replace Temp with Query or to pave the way for Extract Method .

## How To Apply

- Find all places that use the variable. Instead of the variable, use the expression that had been assigned to it.
- Delete the declaration of the variable and its assignment line.

## Benefits

- This refactoring technique offers almost no benefit in and of itself. However, if the variable is assigned the result of a method, you can marginally improve the readability of the program by getting rid of the unnecessary variable.

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

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`
- `Replace Temp with Query` (`replace-temp-with-query`) -> `techniques/composing-methods/replace-temp-with-query.md`

### Eliminates Smell

- None.
