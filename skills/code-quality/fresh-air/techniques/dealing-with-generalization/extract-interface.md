# Extract Interface

## Metadata

- `id`: `extract-interface`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/extract-interface

## Problem

Multiple clients are using the same part of a class interface.

## Solution

Move this identical portion to its own interface.

## When To Apply

Multiple clients are using the same part of a class interface. Interfaces are very apropos when classes play special roles in different situations.

## Why Refactor

Interfaces are very apropos when classes play special roles in different situations.

## How To Apply

- Create an empty interface.
- Declare common operations in the interface.
- Declare the necessary classes as implementing the interface.
- Change type declarations in the client code to use the new interface.

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

- `Extract Superclass` (`extract-superclass`) -> `techniques/dealing-with-generalization/extract-superclass.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
