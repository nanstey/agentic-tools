# Change Reference to Value

## Metadata

- `id`: `change-reference-to-value`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/change-reference-to-value

## Problem

You have a reference object that’s too small and infrequently changed to justify managing its life cycle.

## Solution

Turn it into a value object.

## When To Apply

You have a reference object that’s too small and infrequently changed to justify managing its life cycle. Inspiration to switch from a reference to a value may come from the inconvenience of working with the reference.

## Why Refactor

Inspiration to switch from a reference to a value may come from the inconvenience of working with the reference.

## How To Apply

- Make the object unchangeable. The object shouldn’t have any setters or other methods that change its state and data ( Remove Setting Method may help here). The only place where data should be assigned to the fields of a value object is a constructor.
- Create a comparison method to be able to compare two values.
- Check whether you can delete the factory method and make the object constructor public.

## Benefits

- One important property of objects is that they should be unchangeable. The same result should be received for each query that returns an object value. If this is true, no problems arise if there are many objects representing the same thing.
- Values are much easier to implement.

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
