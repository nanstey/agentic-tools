# Replace Type Code with State/Strategy

## Metadata

- `id`: `replace-type-code-with-state-strategy`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-type-code-with-state-strategy

## Problem

You have a coded type that affects behavior but you can’t use subclasses to get rid of it.

## Solution

Replace type code with a state object.

## When To Apply

You have a coded type that affects behavior but you can’t use subclasses to get rid of it. You have type code and it affects the behavior of a class, therefore we can’t use Replace Type Code with Class .

## Why Refactor

You have type code and it affects the behavior of a class, therefore we can’t use Replace Type Code with Class .

## How To Apply

- Use Self Encapsulate Field to create a getter for the field that contains type code.
- Create a new class and give it an understandable name that fits the purpose of the type code. This class will be playing the role of state (or strategy ). In it, create an abstract coded field getter.
- Create subclasses of the state class for each value of the coded type. In each subclass, redefine the getter of the coded field so that it returns the corresponding value of the coded type.
- In the abstract state class, create a static factory method that accepts the value of the coded type as a parameter. Depending on this parameter, the factory method will create objects of various states. For this, in its code create a large conditional; it’ll be the only one when refactoring is complete.
- In the original class, change the type of the coded field to the state class. In the field’s setter, call the factory state method for getting new state objects.
- Now you can start to move the fields and methods from the superclass to the corresponding state subclasses (using Push Down Field and Push Down Method ).
- When everything moveable has been moved, use Replace Conditional with Polymorphism in order to get rid of conditionals that use type code once and for all.

## Benefits

- This refactoring technique is a way out of situations when a field with a coded type changes its value during the object’s lifetime. In this case, replacement of the value is made via replacement of the state object to which the original class refers.
- If you need to add a new value of a coded type, all you need to do is to add a new state subclass without altering the existing code (cf. the Open/Closed Principle ).

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

- `Replace Type Code with Class` (`replace-type-code-with-class`) -> `techniques/organizing-data/replace-type-code-with-class.md`
- `Replace Type Code with Subclasses` (`replace-type-code-with-subclasses`) -> `techniques/organizing-data/replace-type-code-with-subclasses.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
