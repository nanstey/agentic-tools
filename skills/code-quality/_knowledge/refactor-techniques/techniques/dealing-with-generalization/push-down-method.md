# Push Down Method

## Metadata

- `id`: `push-down-method`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/push-down-method

## Problem

Is behavior implemented in a superclass used by only one (or a few) subclasses?

## Solution

Move this behavior to the subclasses.

## When To Apply

Is behavior implemented in a superclass used by only one (or a few) subclasses? At first a certain method was meant to be universal for all classes but in reality is used in only one subclass.

## Why Refactor

At first a certain method was meant to be universal for all classes but in reality is used in only one subclass.

## How To Apply

- Declare the method in a subclass and copy its code from the superclass.
- Remove the method from the superclass.
- Find all places where the method is used and verify that it’s called from the necessary subclass.

## Benefits

- Improves class coherence. A method is located where you expect to see it.

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

- `Push Down Field` (`push-down-field`) -> `techniques/dealing-with-generalization/push-down-field.md`

### Helps Refactoring

- `Extract Subclass` (`extract-subclass`) -> `techniques/dealing-with-generalization/extract-subclass.md`

### Eliminates Smell

- None.
