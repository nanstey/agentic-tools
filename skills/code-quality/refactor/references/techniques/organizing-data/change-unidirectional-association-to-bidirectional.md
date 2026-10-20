# Change Unidirectional Association to Bidirectional

## Metadata

- `id`: `change-unidirectional-association-to-bidirectional`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/change-unidirectional-association-to-bidirectional

## Problem

You have two classes that each need to use the features of the other, but the association between them is only unidirectional.

## Solution

Add the missing association to the class that needs it.

## When To Apply

You have two classes that each need to use the features of the other, but the association between them is only unidirectional. Originally the classes had a unidirectional association.

## Why Refactor

Originally the classes had a unidirectional association.

## How To Apply

- Add a field for holding the reverse association.
- Decide which class will be “dominant”. This class will contain the methods that create or update the association as elements are added or changed, establishing the association in its class and calling the utility methods for establishing the association in the associated object.
- Create a utility method for establishing the association in the “non-dominant” class. The method should use what it’s given in parameters to complete the field. Give the method an obvious name so that it isn’t used later for any other purposes.
- If old methods for controlling the unidirectional association were in the “dominant” class, complement them with calls to utility methods from the associated object.
- If the old methods for controlling the association were in the “non-dominant” class, create the methods in the “dominant” class, call them, and delegate execution to them.

## Benefits

- If a class needs a reverse association, you can calculate it. But if these calculations are complex, it’s better to keep the reverse association.

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
