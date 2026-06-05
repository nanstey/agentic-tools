# Replace Temp with Query

## Metadata

- `id`: `replace-temp-with-query`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/replace-temp-with-query

## Problem

You place the result of an expression in a local variable for later use in your code.

## Solution

Move the entire expression to a separate method and return the result from it.

## When To Apply

You place the result of an expression in a local variable for later use in your code. This refactoring can lay the groundwork for applying Extract Method for a portion of a very long method.

## Why Refactor

This refactoring can lay the groundwork for applying Extract Method for a portion of a very long method.

## How To Apply

- Make sure that a value is assigned to the variable once and only once within the method. If not, use Split Temporary Variable to ensure that the variable will be used only to store the result of your expression.
- Use Extract Method to place the expression of interest in a new method. Make sure that this method only returns a value and doesn’t change the state of the object. If the method affects the visible state of the object, use Separate Query from Modifier .
- Replace the variable with a query to your new method.

## Benefits

- Code readability. It’s much easier to understand the purpose of the method getTax() than the line orderPrice() * 0.2 .
- Slimmer code via deduplication, if the line being replaced is used in multiple methods.

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

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
