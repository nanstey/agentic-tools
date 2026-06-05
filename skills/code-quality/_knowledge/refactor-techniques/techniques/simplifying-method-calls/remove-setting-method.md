# Remove Setting Method

## Metadata

- `id`: `remove-setting-method`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/remove-setting-method

## Problem

The value of a field should be set only when it’s created, and not change at any time after that.

## Solution

So remove methods that set the field’s value.

## When To Apply

The value of a field should be set only when it’s created, and not change at any time after that. You want to prevent any changes to the value of a field.

## Why Refactor

You want to prevent any changes to the value of a field.

## How To Apply

- The value of a field should be changeable only in the constructor. If the constructor doesn’t contain a parameter for setting the value, add one.
- Find all setter calls. If a setter call is located right after a call for the constructor of the current class, move its argument to the constructor call and remove the setter.
- Replace setter calls in the constructor with direct access to the field.
- Delete the setter.

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

- `Change Reference to Value` (`change-reference-to-value`) -> `techniques/organizing-data/change-reference-to-value.md`

### Eliminates Smell

- None.
