# Replace Data Value with Object

## Metadata

- `id`: `replace-data-value-with-object`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-data-value-with-object

## Problem

A class (or group of classes) contains a data field.

## Solution

Create a new class, place the old field and its behavior in the class, and store the object of the class in the original class.

## When To Apply

A class (or group of classes) contains a data field. This refactoring is basically a special case of Extract Class .

## Why Refactor

This refactoring is basically a special case of Extract Class .

## How To Apply

- Create a new class and copy your field and relevant getter to it. In addition, create a constructor that accepts the simple value of the field. This class won’t have a setter since each new field value that’s sent to the original class will create a new value object.
- In the original class, change the field type to the new class.
- In the getter in the original class, invoke the getter of the associated object.
- In the setter, create a new value object. You may need to also create a new object in the constructor if initial values had been set there for the field previously.

## Benefits

- Improves relatedness inside classes. Data and the relevant behaviors are inside a single class.

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

- `Extract Class` (`extract-class`) -> `techniques/moving-features-between-objects/extract-class.md`
- `Introduce Parameter Object` (`introduce-parameter-object`) -> `techniques/simplifying-method-calls/introduce-parameter-object.md`
- `Replace Array with Object` (`replace-array-with-object`) -> `techniques/organizing-data/replace-array-with-object.md`
- `Replace Method with Method Object` (`replace-method-with-method-object`) -> `techniques/composing-methods/replace-method-with-method-object.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
