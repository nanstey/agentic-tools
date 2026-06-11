# Replace Subclass with Fields

## Metadata

- `id`: `replace-subclass-with-fields`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-subclass-with-fields

## Problem

You have subclasses differing only in their (constant-returning) methods.

## Solution

Replace the methods with fields in the parent class and delete the subclasses.

## When To Apply

You have subclasses differing only in their (constant-returning) methods. Sometimes refactoring is the right approach for avoiding type code.

## Why Refactor

Sometimes refactoring is the right approach for avoiding type code.

## How To Apply

- Apply Replace Constructor with Factory Method to the subclasses.
- Replace subclass constructor calls with superclass factory method calls.
- In the superclass, declare fields for storing the values of each of the subclass methods that return constant values.
- Create a protected superclass constructor for initializing the new fields.
- Create or modify the existing subclass constructors so that they call the new constructor of the parent class and pass the relevant values to it.
- Implement each constant method in the parent class so that it returns the value of the corresponding field. Then remove the method from the subclass.
- If the subclass constructor has additional functionality, use Inline Method to incorporate the constructor into the superclass factory method.
- Delete the subclass.

## Benefits

- Simplifies system architecture. Creating subclasses is overkill if all you want to do is to return different values in different methods.

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
