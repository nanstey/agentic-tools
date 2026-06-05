# Self Encapsulate Field

## Metadata

- `id`: `self-encapsulate-field`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/self-encapsulate-field

## Problem

You use direct access to private fields inside a class.

## Solution

Create a getter and setter for the field, and use only them for accessing the field.

## When To Apply

You use direct access to private fields inside a class. Sometimes directly accessing a private field inside a class just isn’t flexible enough.

## Why Refactor

Sometimes directly accessing a private field inside a class just isn’t flexible enough.

## How To Apply

- Create a getter (and optional setter) for the field. They should be either protected or public .
- Find all direct invocations of the field and replace them with getter and setter calls.

## Benefits

- Indirect access to fields is when a field is acted on via access methods (getters and setters). This approach is much more flexible than direct access to fields . First, you can perform complex operations when data in the field is set or received. Lazy initialization and validation of field values are easily implemented inside field getters and setters.
- Second and more crucially, you can redefine getters and setters in subclasses.
- You have the option of not implementing a setter for a field at all. The field value will be specified only in the constructor, thus making the field unchangeable throughout the entire object lifespan.

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

- `Encapsulate Field` (`encapsulate-field`) -> `techniques/organizing-data/encapsulate-field.md`

### Helps Refactoring

- `Duplicate Observed Data` (`duplicate-observed-data`) -> `techniques/organizing-data/duplicate-observed-data.md`
- `Replace Type Code with State/Strategy` (`replace-type-code-with-state-strategy`) -> `techniques/organizing-data/replace-type-code-with-state-strategy.md`
- `Replace Type Code with Subclasses` (`replace-type-code-with-subclasses`) -> `techniques/organizing-data/replace-type-code-with-subclasses.md`

### Eliminates Smell

- None.
