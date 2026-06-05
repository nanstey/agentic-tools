# Replace Type Code with Subclasses

## Metadata

- `id`: `replace-type-code-with-subclasses`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-type-code-with-subclasses

## Problem

You have a coded type that directly affects program behavior (values of this field trigger various code in conditionals).

## Solution

Create subclasses for each value of the coded type.

## When To Apply

You have a coded type that directly affects program behavior (values of this field trigger various code in conditionals). This refactoring technique is a more complicated twist on Replace Type Code with Class .

## Why Refactor

This refactoring technique is a more complicated twist on Replace Type Code with Class .

## How To Apply

- Use Self Encapsulate Field to create a getter for the field that contains type code.
- Make the superclass constructor private. Create a static factory method with the same parameters as the superclass constructor. It must contain the parameter that will take the starting values of the coded type. Depending on this parameter, the factory method will create objects of various subclasses. To do so, in its code you must create a large conditional but, at least, it’ll be the only one when it’s truly necessary; otherwise, subclasses and polymorphism will do.
- Create a unique subclass for each value of the coded type. In it, redefine the getter of the coded type so that it returns the corresponding value of the coded type.
- Delete the field with type code from the superclass. Make its getter abstract.
- Now that you have subclasses, you can start to move the fields and methods from the superclass to corresponding subclasses (with the help of Push Down Field and Push Down Method ).
- When everything possible has been moved, use Replace Conditional with Polymorphism in order to get rid of conditions that use the type code once and for all.

## Benefits

- Delete the control flow code. Instead of a bulky switch in the original class, move the code to appropriate subclasses. This improves adherence to the Single Responsibility Principle and makes the program more readable in general.
- If you need to add a new value for a coded type, all you need to do is add a new subclass without touching the existing code (cf. the Open/Closed Principle ).
- By replacing type code with classes, we pave the way for type hinting for methods and fields at the level of the programming language. This wouldn’t be possible using simple numeric or string values contained in a coded type.

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
- `Replace Type Code with State/Strategy` (`replace-type-code-with-state-strategy`) -> `techniques/organizing-data/replace-type-code-with-state-strategy.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
