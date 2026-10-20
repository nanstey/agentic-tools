# Separate Query from Modifier

## Metadata

- `id`: `separate-query-from-modifier`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/separate-query-from-modifier

## Problem

Do you have a method that returns a value but also changes something inside an object?

## Solution

Split the method into two separate methods.

## When To Apply

Do you have a method that returns a value but also changes something inside an object? This factoring technique implements Command and Query Responsibility Segregation .

## Why Refactor

This factoring technique implements Command and Query Responsibility Segregation .

## How To Apply

- Create a new query method to return what the original method did.
- Change the original method so that it returns only the result of calling the new query method .
- Replace all references to the original method with a call to the query method . Immediately before this line, place a call to the modifier method . This will save you from side effects in case if the original method was used in a condition of a conditional operator or loop.
- Get rid of the value-returning code in the original method, which now has become a proper modifier method .

## Benefits

- If you have a query that doesn’t change the state of your program, you can call it as many times as you like without having to worry about unintended changes in the result caused by the mere fact of you calling the method.

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

- `Replace Temp with Query` (`replace-temp-with-query`) -> `techniques/composing-methods/replace-temp-with-query.md`

### Eliminates Smell

- None.
