# Replace Constructor with Factory Method

## Metadata

- `id`: `replace-constructor-with-factory-method`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/replace-constructor-with-factory-method

## Problem

You have a complex constructor that does something more than just setting parameter values in object fields.

## Solution

Create a factory method and use it to replace constructor calls.

## When To Apply

You have a complex constructor that does something more than just setting parameter values in object fields. The most obvious reason for using this refactoring technique is related to Replace Type Code with Subclasses .

## Why Refactor

The most obvious reason for using this refactoring technique is related to Replace Type Code with Subclasses .

## How To Apply

- Create a factory method. Place a call to the current constructor in it.
- Replace all constructor calls with calls to the factory method.
- Declare the constructor private.
- Investigate the constructor code and try to isolate the code not directly related to constructing an object of the current class, moving such code to the factory method.

## Benefits

- A factory method doesn’t necessarily return an object of the class in which it was called. Often these could be its subclasses, selected based on the arguments given to the method.
- A factory method can have a better name that describes what and how it returns what it does, for example Troops::GetCrew(myTank) .
- A factory method can return an already created object, unlike a constructor, which always creates a new instance.

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

- `Change Value to Reference` (`change-value-to-reference`) -> `techniques/organizing-data/change-value-to-reference.md`
- `Replace Type Code with Subclasses` (`replace-type-code-with-subclasses`) -> `techniques/organizing-data/replace-type-code-with-subclasses.md`

### Eliminates Smell

- None.
