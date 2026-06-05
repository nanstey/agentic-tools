# Remove Parameter

## Metadata

- `id`: `remove-parameter`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/remove-parameter

## Problem

A parameter isn’t used in the body of a method.

## Solution

Remove the unused parameter.

## When To Apply

A parameter isn’t used in the body of a method. Every parameter in a method call forces the programmer reading it to figure out what information is found in this parameter.

## Why Refactor

Every parameter in a method call forces the programmer reading it to figure out what information is found in this parameter.

## How To Apply

- See whether the method is defined in a superclass or subclass. If so, is the parameter used there? If the parameter is used in one of these implementations, hold off on this refactoring technique.
- The next step is important for keeping the program functional during the refactoring process. Create a new method by copying the old one and delete the relevant parameter from it. Replace the code of the old method with a call to the new one.
- Find all references to the old method and replace them with references to the new method.
- Delete the old method. Don’t perform this step if the old method is part of a public interface. In this case, mark the old method as deprecated.

## Benefits

- A method contains only the parameters that it truly requires.

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

- `Rename Method` (`rename-method`) -> `techniques/simplifying-method-calls/rename-method.md`

### Helps Refactoring

- `Replace Parameter with Method Call` (`replace-parameter-with-method-call`) -> `techniques/simplifying-method-calls/replace-parameter-with-method-call.md`

### Eliminates Smell

- None.
