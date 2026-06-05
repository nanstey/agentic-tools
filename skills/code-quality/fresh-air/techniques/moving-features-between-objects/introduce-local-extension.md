# Introduce Local Extension

## Metadata

- `id`: `introduce-local-extension`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/introduce-local-extension

## Problem

A utility class doesn’t contain some methods that you need.

## Solution

Create a new class containing the methods and make it either the child or wrapper of the utility class.

## When To Apply

A utility class doesn’t contain some methods that you need. The class that you’re using doesn’t have the methods that you need.

## Why Refactor

The class that you’re using doesn’t have the methods that you need.

## How To Apply

- Create a new extension class: Option A: Make it a child of the utility class.
- Option B: If you have decided to make a wrapper, create a field in it for storing the utility class object to which delegation will be made. When using this option, you will need to also create methods that repeat the public methods of the utility class and contain simple delegation to the methods of the utility object.
- Create a constructor that uses the parameters of the constructor of the utility class.
- Also create an alternative “converting” constructor that takes only the object of the original class in its parameters. This will help to substitute the extension for the objects of the original class.
- Create new extended methods in the class. Move foreign methods from other classes to this class or else delete the foreign methods if their functionality is already present in the extension.
- Replace use of the utility class with the new extension class in places where its functionality is needed.

## Benefits

- By moving additional methods to a separate extension class (wrapper or subclass), you avoid gumming up client classes with code that doesn’t fit. Program components are more coherent and are more reusable.

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

- `Introduce Foreign Method` (`introduce-foreign-method`) -> `techniques/moving-features-between-objects/introduce-foreign-method.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
