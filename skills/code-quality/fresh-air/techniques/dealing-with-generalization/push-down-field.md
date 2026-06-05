# Push Down Field

## Metadata

- `id`: `push-down-field`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/push-down-field

## Problem

Is a field used only in a few subclasses?

## Solution

Move the field to these subclasses.

## When To Apply

Is a field used only in a few subclasses? Although it was planned to use a field universally for all classes, in reality the field is used only in some subclasses.

## Why Refactor

Although it was planned to use a field universally for all classes, in reality the field is used only in some subclasses.

## How To Apply

- Declare a field in all the necessary subclasses.
- Remove the field from the superclass.

## Benefits

- Improves internal class coherency. A field is located where it’s actually used.
- When moving to several subclasses simultaneously, you can develop the fields independently of each other. This does create code duplication, yes, so push down fields only when you really do intend to use the fields in different ways.

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

- `Push Down Method` (`push-down-method`) -> `techniques/dealing-with-generalization/push-down-method.md`

### Helps Refactoring

- `Extract Subclass` (`extract-subclass`) -> `techniques/dealing-with-generalization/extract-subclass.md`

### Eliminates Smell

- None.
