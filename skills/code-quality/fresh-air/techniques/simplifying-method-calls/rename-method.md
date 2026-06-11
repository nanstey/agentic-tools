# Rename Method

## Metadata

- `id`: `rename-method`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/rename-method

## Problem

The name of a method doesn’t explain what the method does.

## Solution

Rename the method.

## When To Apply

The name of a method doesn’t explain what the method does. Perhaps a method was poorly named from the very beginning. For example, someone created the method in a rush and didn’t give proper care to naming it well.

## Why Refactor

Perhaps a method was poorly named from the very beginning. For example, someone created the method in a rush and didn’t give proper care to naming it well.

## How To Apply

- See whether the method is defined in a superclass or subclass. If so, you must repeat all steps in these classes too.
- The next method is important for maintaining the functionality of the program during the refactoring process. Create a new method with a new name. Copy the code of the old method to it. Delete all the code in the old method and, instead of it, insert a call for the new method.
- Find all references to the old method and replace them with references to the new one.
- Delete the old method. If the old method is part of a public interface, don’t perform this step. Instead, mark the old method as deprecated.

## Benefits

- Code readability. Try to give the new method a name that reflects what it does. Something like createOrder() , renderCustomerInfo() , etc.

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

- `Add Parameter` (`add-parameter`) -> `techniques/simplifying-method-calls/add-parameter.md`
- `Remove Parameter` (`remove-parameter`) -> `techniques/simplifying-method-calls/remove-parameter.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
