# Move Field

## Metadata

- `id`: `move-field`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/move-field

## Problem

A field is used more in another class than in its own class.

## Solution

Create a field in a new class and redirect all users of the old field to it.

## When To Apply

A field is used more in another class than in its own class. Often fields are moved as part of the Extract Class technique.

## Why Refactor

Often fields are moved as part of the Extract Class technique.

## How To Apply

- If the field is public, refactoring will be much easier if you make the field private and provide public access methods (for this, you can use Encapsulate Field ).
- Create the same field with access methods in the recipient class.
- Decide how you will refer to the recipient class. You may already have a field or method that returns the appropriate object; if not, you will need to write a new method or field to store the object of the recipient class.
- Replace all references to the old field with appropriate calls to methods in the recipient class. If the field isn’t private, take care of this in the superclass and subclasses.
- Delete the field in the original class.

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

- `Move Method` (`move-method`) -> `techniques/moving-features-between-objects/move-method.md`

### Helps Refactoring

- `Extract Class` (`extract-class`) -> `techniques/moving-features-between-objects/extract-class.md`
- `Inline Class` (`inline-class`) -> `techniques/moving-features-between-objects/inline-class.md`

### Eliminates Smell

- None.
