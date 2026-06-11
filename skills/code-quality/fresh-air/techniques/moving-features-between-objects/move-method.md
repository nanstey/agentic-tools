# Move Method

## Metadata

- `id`: `move-method`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/move-method

## Problem

A method is used more in another class than in its own class.

## Solution

Create a new method in the class that uses the method the most, then move code from the old method to there.

## When To Apply

A method is used more in another class than in its own class. You want to move a method to a class that contains most of the data used by the method.

## Why Refactor

You want to move a method to a class that contains most of the data used by the method.

## How To Apply

- Verify all features used by the old method in its class. It may be a good idea to move them as well. As a rule, if a feature is used only by the method under consideration, you should move the feature to it. If the feature is used by other methods too, you should move these methods as well. Sometimes it’s much easier to move a large number of methods than to set up relationships between them in different classes. Make sure that the method isn’t declared in superclasses and subclasses. If this is the case, you will either have to refrain from moving or else implement a kind of polymorphism in the recipient class in order to ensure varying functionality of a method split up among donor classes.
- Declare the new method in the recipient class. You may want to give a new name for the method that’s more appropriate for it in the new class.
- Decide how you will refer to the recipient class. You may already have a field or method that returns an appropriate object, but if not, you will need to write a new method or field to store the object of the recipient class. Now you have a way to refer to the recipient object and a new method in its class. With all this under your belt, you can turn the old method into a reference to the new method.
- Take a look: can you delete the old method entirely? If so, place a reference to the new method in all places that use the old one.

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

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`
- `Move Field` (`move-field`) -> `techniques/moving-features-between-objects/move-field.md`

### Helps Refactoring

- `Extract Class` (`extract-class`) -> `techniques/moving-features-between-objects/extract-class.md`
- `Inline Class` (`inline-class`) -> `techniques/moving-features-between-objects/inline-class.md`
- `Introduce Parameter Object` (`introduce-parameter-object`) -> `techniques/simplifying-method-calls/introduce-parameter-object.md`

### Eliminates Smell

- None.
