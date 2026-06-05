# Change Bidirectional Association to Unidirectional

## Metadata

- `id`: `change-bidirectional-association-to-unidirectional`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/change-bidirectional-association-to-unidirectional

## Problem

You have a bidirectional association between classes, but one of the classes doesn’t use the other’s features.

## Solution

Remove the unused association.

## When To Apply

You have a bidirectional association between classes, but one of the classes doesn’t use the other’s features. A bidirectional association is generally harder to maintain than a unidirectional one, requiring additional code for properly creating and deleting the relevant objects.

## Why Refactor

A bidirectional association is generally harder to maintain than a unidirectional one, requiring additional code for properly creating and deleting the relevant objects.

## How To Apply

- Make sure that one of the following is true for your classes: No association is used.
- There’s another way to get the associated object, such through a database query.
- The associated object can be passed as an argument to the methods that use it.
- Depending on your situation, use of a field that contains an association with another object should be replaced by a parameter or method call for getting the object in a different way.
- Delete the code that assigns the associated object to the field.
- Delete the now-unused field.

## Benefits

- Simplifies the class that doesn’t need the relationship. Less code equals less code maintenance.
- Reduces dependency between classes. Independent classes are easier to maintain since any changes to a class affect only that class.

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
