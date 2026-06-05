# Encapsulate Collection

## Metadata

- `id`: `encapsulate-collection`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/encapsulate-collection

## Problem

A class contains a collection field and a simple getter and setter for working with the collection.

## Solution

Make the getter-returned value read-only and create methods for adding/deleting elements of the collection.

## When To Apply

A class contains a collection field and a simple getter and setter for working with the collection. A class contains a field that contains a collection of objects.

## Why Refactor

A class contains a field that contains a collection of objects.

## How To Apply

- Create methods for adding and deleting collection elements. They must accept collection elements in their parameters.
- Assign an empty collection to the field as the initial value if this isn’t done in the class constructor.
- Find the calls of the collection field setter. Change the setter so that it uses operations for adding and deleting elements, or make these operations call client code.

## Benefits

- The collection field is encapsulated inside a class. When the getter is called, it returns a copy of the collection, which prevents accidental changing or overwriting of the collection elements without the knowledge of the class that contains the collection.
- If collection elements are contained inside a primitive type, such as an array, you create more convenient methods for working with the collection.
- If collection elements are contained inside a non-primitive container (standard collection class), by encapsulating the collection you can restrict access to unwanted standard methods of the collection (such as by restricting addition of new elements).

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
