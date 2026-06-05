# Replace Parameter with Explicit Methods

## Metadata

- `id`: `replace-parameter-with-explicit-methods`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/replace-parameter-with-explicit-methods

## Problem

A method is split into parts, each of which is run depending on the value of a parameter.

## Solution

Extract the individual parts of the method into their own methods and call them instead of the original method.

## When To Apply

A method is split into parts, each of which is run depending on the value of a parameter. A method containing parameter-dependent variants has grown massive.

## Why Refactor

A method containing parameter-dependent variants has grown massive.

## How To Apply

- For each variant of the method, create a separate method. Run these methods based on the value of a parameter in the main method.
- Find all places where the original method is called. In these places, place a call for one of the new parameter-dependent variants.
- When no calls to the original method remain, delete it.

## Benefits

- Improves code readability. It’s much easier to understand the purpose of startEngine() than setValue("engineEnabled", true) .

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

- `Replace Conditional with Polymorphism` (`replace-conditional-with-polymorphism`) -> `techniques/simplifying-conditional-expressions/replace-conditional-with-polymorphism.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
