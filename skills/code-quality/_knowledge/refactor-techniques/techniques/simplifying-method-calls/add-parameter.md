# Add Parameter

## Metadata

- `id`: `add-parameter`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/add-parameter

## Problem

A method doesn’t have enough data to perform certain actions.

## Solution

Create a new parameter to pass the necessary data.

## When To Apply

A method doesn’t have enough data to perform certain actions. You need to make changes to a method and these changes require adding information or data that was previously not available to the method.

## Why Refactor

You need to make changes to a method and these changes require adding information or data that was previously not available to the method.

## How To Apply

- See whether the method is defined in a superclass or subclass. If the method is present in them, you will need to repeat all the steps in these classes as well.
- The following step is critical for keeping your program functional during the refactoring process. Create a new method by copying the old one and add the necessary parameter to it. Replace the code for the old method with a call to the new method. You can plug in any value to the new parameter (such as null for objects or a zero for numbers).
- Find all references to the old method and replace them with references to the new method.
- Delete the old method. Deletion isn’t possible if the old method is part of the public interface. If that’s the case, mark the old method as deprecated.

## Benefits

- The choice here is between adding a new parameter and adding a new private field that contains the data needed by the method. A parameter is preferable when you need some occasional or frequently changing data for which there’s no point in holding it in an object all of the time. In this case, the refactoring will pay off. Otherwise, add a private field and fill it with the necessary data before calling the method.

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

- `Introduce Parameter Object` (`introduce-parameter-object`) -> `techniques/simplifying-method-calls/introduce-parameter-object.md`

### Eliminates Smell

- None.
