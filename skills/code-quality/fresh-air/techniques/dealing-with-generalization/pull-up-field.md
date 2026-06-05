# Pull Up Field

## Metadata

- `id`: `pull-up-field`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/pull-up-field

## Problem

Two classes have the same field.

## Solution

Remove the field from subclasses and move it to the superclass.

## When To Apply

Two classes have the same field. Subclasses grew and developed separately, causing identical (or nearly identical) fields and methods to appear.

## Why Refactor

Subclasses grew and developed separately, causing identical (or nearly identical) fields and methods to appear.

## How To Apply

- Make sure that the fields are used for the same needs in subclasses.
- If the fields have different names, give them the same name and replace all references to the fields in existing code.
- Create a field with the same name in the superclass. Note that if the fields were private, the superclass field should be protected.
- Remove the fields from the subclasses.
- You may want to consider using Self Encapsulate Field for the new field, in order to hide it behind access methods.

## Benefits

- Eliminates duplication of fields in subclasses.
- Eases subsequent relocation of duplicate methods, if they exist, from subclasses to a superclass.

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

- `Pull Up Method` (`pull-up-method`) -> `techniques/dealing-with-generalization/pull-up-method.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
