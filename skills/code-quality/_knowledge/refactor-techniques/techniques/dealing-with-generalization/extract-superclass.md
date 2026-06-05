# Extract Superclass

## Metadata

- `id`: `extract-superclass`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/extract-superclass

## Problem

You have two classes with common fields and methods.

## Solution

Create a shared superclass for them and move all the identical fields and methods to it.

## When To Apply

You have two classes with common fields and methods. One type of code duplication occurs when two classes perform similar tasks in the same way, or perform similar tasks in different ways.

## Why Refactor

One type of code duplication occurs when two classes perform similar tasks in the same way, or perform similar tasks in different ways.

## How To Apply

- Create an abstract superclass.
- Use Pull Up Field , Pull Up Method , and Pull Up Constructor Body to move the common functionality to a superclass. Start with the fields, since in addition to the common fields you will need to move the fields that are used in the common methods.
- Look for places in the client code where use of subclasses can be replaced with your new class (such as in type declarations).

## Benefits

- Code deduplication. Common fields and methods now “live” in one place only.

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

- `Extract Interface` (`extract-interface`) -> `techniques/dealing-with-generalization/extract-interface.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
