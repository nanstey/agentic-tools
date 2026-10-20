# Introduce Parameter Object

## Metadata

- `id`: `introduce-parameter-object`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/introduce-parameter-object

## Problem

Your methods contain a repeating group of parameters.

## Solution

Replace these parameters with an object.

## When To Apply

Your methods contain a repeating group of parameters. Identical groups of parameters are often encountered in multiple methods.

## Why Refactor

Identical groups of parameters are often encountered in multiple methods.

## How To Apply

- Create a new class that will represent your group of parameters. Make the class immutable.
- In the method that you want to refactor, use Add Parameter , which is where your parameter object will be passed. In all method calls, pass the object created from old method parameters to this parameter.
- Now start deleting old parameters from the method one by one, replacing them in the code with fields of the parameter object. Test the program after each parameter replacement.
- When done, see whether there’s any point in moving a part of the method (or sometimes even the whole method) to a parameter object class. If so, use Move Method or Extract Method .

## Benefits

- More readable code. Instead of a hodgepodge of parameters, you see a single object with a comprehensible name.
- Identical groups of parameters scattered here and there create their own kind of code duplication: while identical code isn’t being called, identical groups of parameters and arguments are constantly encountered.

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

- `Preserve Whole Object` (`preserve-whole-object`) -> `techniques/simplifying-method-calls/preserve-whole-object.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
