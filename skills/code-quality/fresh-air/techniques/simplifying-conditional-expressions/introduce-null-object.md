# Introduce Null Object

## Metadata

- `id`: `introduce-null-object`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/introduce-null-object

## Problem

Since some methods return null instead of real objects, you have many checks for null in your code.

## Solution

Instead of null , return a null object that exhibits the default behavior.

## When To Apply

Since some methods return null instead of real objects, you have many checks for null in your code. Dozens of checks for null make your code longer and uglier.

## Why Refactor

Dozens of checks for null make your code longer and uglier.

## How To Apply

- From the class in question, create a subclass that will perform the role of null object.
- In both classes, create the method isNull() , which will return true for a null object and false for a real class.
- Find all places where the code may return null instead of a real object. Change the code so that it returns a null object.
- Find all places where the variables of the real class are compared with null . Replace these checks with a call for isNull() .
- If methods of the original class are run in these conditionals when a value doesn’t equal null , redefine these methods in the null class and insert the code from the else part of the condition there. Then you can delete the entire conditional and differing behavior will be implemented via polymorphism.
- If things aren’t so simple and the methods can’t be redefined, see if you can extract the operators that were supposed to be performed in the case of a null value to new methods of the null object. Call these methods instead of the old code in else as the operations by default.

## Benefits

- Not captured yet.

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

- `Replace Conditional with Polymorphism` (`replace-conditional-with-polymorphism`) -> `techniques/simplifying-conditional-expressions/replace-conditional-with-polymorphism.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
