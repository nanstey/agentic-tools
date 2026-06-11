# Extract Class

## Metadata

- `id`: `extract-class`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/extract-class

## Problem

When one class does the work of two, awkwardness results.

## Solution

Instead, create a new class and place the fields and methods responsible for the relevant functionality in it.

## When To Apply

When one class does the work of two, awkwardness results. Classes always start out clear and easy to understand.

## Why Refactor

Classes always start out clear and easy to understand.

## How To Apply

- Create a new class to contain the relevant functionality.
- Create a relationship between the old class and the new one. Optimally, this relationship is unidirectional; this allows reusing the second class without any issues. Nonetheless, if you think that a two-way relationship is necessary, this can always be set up.
- Use Move Field and Move Method for each field and method that you have decided to move to the new class. For methods, start with private ones in order to reduce the risk of making a large number of errors. Try to relocate a little bit at a time and test the results after each move, in order to avoid a pileup of error-fixing at the very end. After you’re done moving, take one more look at the resulting classes. An old class with changed responsibilities may be renamed for increased clarity. Check again to see whether you can get rid of two-way class relationships, if any are present.
- Also give thought to accessibility to the new class from the outside. You can hide the class from the client entirely by making it private, managing it via the fields from the old class. Alternatively, you can make it a public one by allowing the client to change values directly. Your decision here depends on how safe it’s for the behavior of the old class when unexpected direct changes are made to the values in the new class.

## Benefits

- This refactoring method will help maintain adherence to the Single Responsibility Principle . The code of your classes will be more obvious and understandable.
- Single-responsibility classes are more reliable and tolerant of changes. For example, say that you have a class responsible for ten different things. When you change this class to make it better for one thing, you risk breaking it for the nine others.

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

- `Extract Subclass` (`extract-subclass`) -> `techniques/dealing-with-generalization/extract-subclass.md`
- `Replace Data Value with Object` (`replace-data-value-with-object`) -> `techniques/organizing-data/replace-data-value-with-object.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
