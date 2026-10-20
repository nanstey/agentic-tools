# Pull Up Constructor Body

## Metadata

- `id`: `pull-up-constructor-body`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/pull-up-constructor-body

## Problem

Your subclasses have constructors with code that’s mostly identical.

## Solution

Create a superclass constructor and move the code that’s the same in the subclasses to it.

## When To Apply

Your subclasses have constructors with code that’s mostly identical. How is this refactoring technique different from Pull Up Method ?

## Why Refactor

How is this refactoring technique different from Pull Up Method ?

## How To Apply

- Create a constructor in a superclass.
- Extract the common code from the beginning of the constructor of each subclass to the superclass constructor. Before doing so, try to move as much common code as possible to the beginning of the constructor.
- Place the call for the superclass constructor in the first line in the subclass constructors.

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

- `Pull Up Method` (`pull-up-method`) -> `techniques/dealing-with-generalization/pull-up-method.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
