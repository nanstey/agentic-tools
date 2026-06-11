# Inline Class

## Metadata

- `id`: `inline-class`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/inline-class

## Problem

A class does almost nothing and isn’t responsible for anything, and no additional responsibilities are planned for it.

## Solution

Move all features from the class to another one.

## When To Apply

A class does almost nothing and isn’t responsible for anything, and no additional responsibilities are planned for it. Often this technique is needed after the features of one class are “transplanted” to other classes, leaving that class with little to do.

## Why Refactor

Often this technique is needed after the features of one class are “transplanted” to other classes, leaving that class with little to do.

## How To Apply

- In the recipient class, create the public fields and methods present in the donor class. Methods should refer to the equivalent methods of the donor class.
- Replace all references to the donor class with references to the fields and methods of the recipient class.
- Now test the program and make sure that no errors have been added. If tests show that everything is working A-OK, start using Move Method and Move Field to completely transplant all functionality to the recipient class from the original one. Continue doing so until the original class is completely empty.
- Delete the original class.

## Benefits

- Eliminating needless classes frees up operating memory on the computer, and bandwidth in your head.

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
