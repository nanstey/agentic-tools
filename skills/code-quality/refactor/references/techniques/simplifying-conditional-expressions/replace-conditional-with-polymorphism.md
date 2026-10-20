# Replace Conditional with Polymorphism

## Metadata

- `id`: `replace-conditional-with-polymorphism`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/replace-conditional-with-polymorphism

## Problem

You have a conditional that performs various actions depending on object type or properties.

## Solution

Create subclasses matching the branches of the conditional.

## When To Apply

You have a conditional that performs various actions depending on object type or properties. This refactoring technique can help if your code contains operators performing various tasks that vary based on: Class of the object or interface that it implements Value of an object’s field Result of calling one of an object’s methods If a new object property or type appears, you will need to search for and add code in all similar conditionals.

## Why Refactor

This refactoring technique can help if your code contains operators performing various tasks that vary based on: Class of the object or interface that it implements Value of an object’s field Result of calling one of an object’s methods If a new object property or type appears, you will need to search for and add code in all similar conditionals.

## How To Apply

- Not captured yet.

## Benefits

- This technique adheres to the Tell-Don’t-Ask principle: instead of asking an object about its state and then performing actions based on this, it’s much easier to tell the object what it needs to do and let it decide for itself how to do that.
- Removes duplicate code. You get rid of many almost identical conditionals.
- If you need to add a new execution variant, all you need to do is add a new subclass without touching the existing code ( Open/Closed Principle ).

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
