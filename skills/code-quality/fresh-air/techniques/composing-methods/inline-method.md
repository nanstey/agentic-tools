# Inline Method

## Metadata

- `id`: `inline-method`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/inline-method

## Problem

When a method body is more obvious than the method itself, use this technique.

## Solution

Replace calls to the method with the method’s content and delete the method itself.

## When To Apply

When a method body is more obvious than the method itself, use this technique. A method simply delegates to another method.

## Why Refactor

A method simply delegates to another method.

## How To Apply

- Make sure that the method isn’t redefined in subclasses. If the method is redefined, refrain from this technique.
- Find all calls to the method. Replace these calls with the content of the method.
- Delete the method.

## Benefits

- By minimizing the number of unneeded methods, you make the code more straightforward.

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
