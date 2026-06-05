# Introduce Foreign Method

## Metadata

- `id`: `introduce-foreign-method`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/introduce-foreign-method

## Problem

A utility class doesn’t contain the method that you need and you can’t add the method to the class.

## Solution

Add the method to a client class and pass an object of the utility class to it as an argument.

## When To Apply

A utility class doesn’t contain the method that you need and you can’t add the method to the class. You have code that uses the data and methods of a certain class.

## Why Refactor

You have code that uses the data and methods of a certain class.

## How To Apply

- Create a new method in the client class.
- In this method, create a parameter to which the object of the utility class will be passed. If this object can be obtained from the client class, you don’t have to create such a parameter.
- Extract the relevant code fragments to this method and replace them with method calls.
- Be sure to leave the Foreign method tag in the comments for the method along with the advice to place this method in a utility class if such becomes possible later. This will make it easier to understand why this method is located in this particular class for those who’ll be maintaining the software in the future.

## Benefits

- Removes code duplication. If your code is repeated in several places, you can replace these code fragments with a method call. This is better than duplication even considering that the foreign method is located in a suboptimal place.

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

- `Introduce Local Extension` (`introduce-local-extension`) -> `techniques/moving-features-between-objects/introduce-local-extension.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
