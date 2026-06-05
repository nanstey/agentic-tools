# Encapsulate Field

## Metadata

- `id`: `encapsulate-field`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/encapsulate-field

## Problem

You have a public field.

## Solution

Make the field private and create access methods for it.

## When To Apply

You have a public field. One of the pillars of object-oriented programming is Encapsulation , the ability to conceal object data.

## Why Refactor

One of the pillars of object-oriented programming is Encapsulation , the ability to conceal object data.

## How To Apply

- Create a getter and setter for the field.
- Find all invocations of the field. Replace receipt of the field value with the getter, and replace setting of new field values with the setter.
- After all field invocations have been replaced, make the field private.

## Benefits

- If the data and behavior of a component are closely interrelated and are in the same place in the code, it’s much easier for you to maintain and develop this component.
- You can also perform complicated operations related to access to object fields.

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

- `Self Encapsulate Field` (`self-encapsulate-field`) -> `techniques/organizing-data/self-encapsulate-field.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
