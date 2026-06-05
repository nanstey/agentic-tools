# Remove Control Flag

## Metadata

- `id`: `remove-control-flag`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/remove-control-flag

## Problem

You have a boolean variable that acts as a control flag for multiple boolean expressions.

## Solution

Instead of the variable, use break , continue and return .

## When To Apply

You have a boolean variable that acts as a control flag for multiple boolean expressions. Control flags date back to the days of yore, when “proper” programmers always had one entry point for their functions (the function declaration line) and one exit point (at the very end of the function).

## Why Refactor

Control flags date back to the days of yore, when “proper” programmers always had one entry point for their functions (the function declaration line) and one exit point (at the very end of the function).

## How To Apply

- Find the value assignment to the control flag that causes the exit from the loop or current iteration.
- Replace it with break , if this is an exit from a loop; continue , if this is an exit from an iteration, or return , if you need to return this value from the function.
- Remove the remaining code and checks associated with the control flag.

## Benefits

- Control flag code is often much more ponderous than code written with control flow operators.

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
