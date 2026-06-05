# Change Value to Reference

## Metadata

- `id`: `change-value-to-reference`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/change-value-to-reference

## Problem

So you have many identical instances of a single class that you need to replace with a single object.

## Solution

Convert the identical objects to a single reference object.

## When To Apply

So you have many identical instances of a single class that you need to replace with a single object. In many systems, objects can be classified as either values or references.

## Why Refactor

In many systems, objects can be classified as either values or references.

## How To Apply

- Use Replace Constructor with Factory Method on the class from which the references are to be generated.
- Determine which object will be responsible for providing access to references. Instead of creating a new object, when you need one you now need to get it from a storage object or static dictionary field.
- Determine whether references will be created in advance or dynamically as necessary. If objects are created in advance, make sure to load them before use.
- Change the factory method so that it returns a reference. If objects are created in advance, decide how to handle errors when a non-existent object is requested. You may also need to use Rename Method to inform that the method returns only existing objects.

## Benefits

- An object contains all the most current information about a particular entity. If the object is changed in one part of the program, these changes are accessible from the other parts of the program that make use of the object.

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
