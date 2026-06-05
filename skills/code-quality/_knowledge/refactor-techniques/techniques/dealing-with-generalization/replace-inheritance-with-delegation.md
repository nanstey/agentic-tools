# Replace Inheritance with Delegation

## Metadata

- `id`: `replace-inheritance-with-delegation`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/replace-inheritance-with-delegation

## Problem

You have a subclass that uses only a portion of the methods of its superclass (or it’s not possible to inherit superclass data).

## Solution

Create a field and put a superclass object in it, delegate methods to the superclass object, and get rid of inheritance.

## When To Apply

You have a subclass that uses only a portion of the methods of its superclass (or it’s not possible to inherit superclass data). Replacing inheritance with composition can substantially improve class design if: Your subclass violates the Liskov substitution principle , i.e., if inheritance was implemented only to combine common code but not because the subclass is an extension of the superclass.

## Why Refactor

Replacing inheritance with composition can substantially improve class design if: Your subclass violates the Liskov substitution principle , i.e., if inheritance was implemented only to combine common code but not because the subclass is an extension of the superclass.

## How To Apply

- Create a field in the subclass for holding the superclass. During the initial stage, place the current object in it.
- Change the subclass methods so that they use the superclass object instead of this .
- For methods inherited from the superclass that are called in the client code, create simple delegating methods in the subclass.
- Remove the inheritance declaration from the subclass.
- Change the initialization code of the field in which the former superclass is stored by creating a new object.

## Benefits

- A class doesn’t contain any unneeded methods inherited from the superclass.
- Various objects with various implementations can be put in the delegate field. In effect you get the Strategy design pattern.

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
