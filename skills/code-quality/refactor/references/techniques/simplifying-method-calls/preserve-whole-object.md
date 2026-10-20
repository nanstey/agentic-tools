# Preserve Whole Object

## Metadata

- `id`: `preserve-whole-object`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/preserve-whole-object

## Problem

You get several values from an object and then pass them as parameters to a method.

## Solution

Instead, try passing the whole object.

## When To Apply

You get several values from an object and then pass them as parameters to a method. The problem is that each time before your method is called, the methods of the future parameter object must be called.

## Why Refactor

The problem is that each time before your method is called, the methods of the future parameter object must be called.

## How To Apply

- Create a parameter in the method for the object from which you can get the necessary values.
- Now start removing the old parameters from the method one by one, replacing them with calls to the relevant methods of the parameter object. Test the program after each replacement of a parameter.
- Delete the getter code from the parameter object that had preceded the method call.

## Benefits

- Instead of a hodgepodge of parameters, you see a single object with a comprehensible name.
- If the method needs more data from an object, you won’t need to rewrite all the places where the method is used, merely inside the method itself.

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

- `Introduce Parameter Object` (`introduce-parameter-object`) -> `techniques/simplifying-method-calls/introduce-parameter-object.md`
- `Replace Parameter with Method Call` (`replace-parameter-with-method-call`) -> `techniques/simplifying-method-calls/replace-parameter-with-method-call.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
