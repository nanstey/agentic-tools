# Replace Delegation with Inheritance

## Metadata

- `id`: `replace-delegation-with-inheritance`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/replace-delegation-with-inheritance

## Problem

A class contains many simple methods that delegate to all methods of another class.

## Solution

Make the class a delegate inheritor, which makes the delegating methods unnecessary.

## When To Apply

A class contains many simple methods that delegate to all methods of another class. Delegation is a more flexible approach than inheritance, since it allows changing how delegation is implemented and placing other classes there as well.

## Why Refactor

Delegation is a more flexible approach than inheritance, since it allows changing how delegation is implemented and placing other classes there as well.

## How To Apply

- Make the class a subclass of the delegate class.
- Place the current object in a field containing a reference to the delegate object.
- Delete the methods with simple delegation one by one. If their names were different, use Rename Method to give all the methods a single name.
- Replace all references to the delegate field with references to the current object.
- Remove the delegate field.

## Benefits

- Reduces code length. All these delegating methods are no longer necessary.

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

- `Remove Middle Man` (`remove-middle-man`) -> `techniques/moving-features-between-objects/remove-middle-man.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
