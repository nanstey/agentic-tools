# Replace Method with Method Object

## Metadata

- `id`: `replace-method-with-method-object`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/replace-method-with-method-object

## Problem

You have a long method in which the local variables are so intertwined that you can’t apply Extract Method .

## Solution

Transform the method into a separate class so that the local variables become fields of the class.

## When To Apply

You have a long method in which the local variables are so intertwined that you can’t apply Extract Method . A method is too long and you can’t separate it due to tangled masses of local variables that are hard to isolate from each other.

## Why Refactor

A method is too long and you can’t separate it due to tangled masses of local variables that are hard to isolate from each other.

## How To Apply

- Create a new class. Name it based on the purpose of the method that you’re refactoring.
- In the new class, create a private field for storing a reference to an instance of the class in which the method was previously located. It could be used to get some required data from the original class if needed.
- Create a separate private field for each local variable of the method.
- Create a constructor that accepts as parameters the values of all local variables of the method and also initializes the corresponding private fields.
- Declare the main method and copy the code of the original method to it, replacing the local variables with private fields.
- Replace the body of the original method in the original class by creating a method object and calling its main method.

## Benefits

- Isolating a long method in its own class allows stopping a method from ballooning in size. This also allows splitting it into submethods within the class, without polluting the original class with utility methods.

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

- `Replace Data Value with Object` (`replace-data-value-with-object`) -> `techniques/organizing-data/replace-data-value-with-object.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
