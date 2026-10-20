# Replace Type Code with Class

## Metadata

- `id`: `replace-type-code-with-class`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-type-code-with-class

## Problem

A class has a field that contains type code.

## Solution

Create a new class and use its objects instead of the type code values.

## When To Apply

A class has a field that contains type code. One of the most common reasons for type code is working with databases, when a database has fields in which some complex concept is coded with a number or string.

## Why Refactor

One of the most common reasons for type code is working with databases, when a database has fields in which some complex concept is coded with a number or string.

## How To Apply

- Create a new class and give it a new name that corresponds to the purpose of the coded type. Here we’ll call it type class .
- Copy the field containing type code to the type class and make it private. Then create a getter for the field. A value will be set for this field only from the constructor.
- For each value of the coded type, create a static method in type class . It’ll be creating a new type class object corresponding to this value of the coded type.
- In the original class, replace the type of the coded field with type class . Create a new object of this type in the constructor as well as in the field setter. Change the field getter so that it calls the type class getter.
- Replace any mentions of values of the coded type with calls of the relevant type class static methods.
- Remove the coded type constants from the original class.

## Benefits

- We want to turn sets of primitive values (which is what coded types are) into full-fledged classes with all the benefits that object-oriented programming has to offer.
- By replacing type code with classes, we allow type hinting for values passed to methods and fields at the level of the programming language. For example, while the compiler previously didn’t see difference between your numeric constant and some arbitrary number when a value is passed to a method, now when data that doesn’t fit the indicated type class is passed, you’re warned of the error inside your IDE.
- Thus we make it possible to move code to the classes of the type. If you needed to perform complex manipulations with type values throughout the whole program, now this code can “live” inside one or multiple type classes.

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

- `Replace Type Code with State/Strategy` (`replace-type-code-with-state-strategy`) -> `techniques/organizing-data/replace-type-code-with-state-strategy.md`
- `Replace Type Code with Subclasses` (`replace-type-code-with-subclasses`) -> `techniques/organizing-data/replace-type-code-with-subclasses.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
