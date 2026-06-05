# Hide Method

## Metadata

- `id`: `hide-method`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/hide-method

## Problem

A method isn’t used by other classes or is used only inside its own class hierarchy.

## Solution

Make the method private or protected.

## When To Apply

A method isn’t used by other classes or is used only inside its own class hierarchy. Quite often, the need to hide methods for getting and setting values is due to development of a richer interface that provides additional behavior, especially if you started with a class that added little beyond mere data encapsulation.

## Why Refactor

Quite often, the need to hide methods for getting and setting values is due to development of a richer interface that provides additional behavior, especially if you started with a class that added little beyond mere data encapsulation.

## How To Apply

- Regularly try to find methods that can be made private. Static code analysis and good unit test coverage can offer a big leg up.
- Make each method as private as possible.

## Benefits

- Hiding methods makes it easier for your code to evolve. When you change a private method, you only need to worry about how to not break the current class since you know that the method can’t be used anywhere else.
- By making methods private, you underscore the importance of the public interface of the class and of the methods that remain public.

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
