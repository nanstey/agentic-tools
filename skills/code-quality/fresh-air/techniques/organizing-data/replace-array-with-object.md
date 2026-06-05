# Replace Array with Object

## Metadata

- `id`: `replace-array-with-object`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-array-with-object

## Problem

You have an array that contains various types of data.

## Solution

Replace the array with an object that will have separate fields for each element.

## When To Apply

You have an array that contains various types of data. Arrays are an excellent tool for storing data and collections of a single type.

## Why Refactor

Arrays are an excellent tool for storing data and collections of a single type.

## How To Apply

- Create the new class that will contain the data from the array. Place the array itself in the class as a public field.
- Create a field for storing the object of this class in the original class. Don’t forget to also create the object itself in the place where you initiated the data array.
- In the new class, create access methods one by one for each of the array elements. Give them self-explanatory names that indicate what they do. At the same time, replace each use of an array element in the main code with the corresponding access method.
- When access methods have been created for all elements, make the array private.
- For each element of the array, create a private field in the class and then change the access methods so that they use this field instead of the array.
- When all data has been moved, delete the array.

## Benefits

- In the resulting class, you can place all associated behaviors that had been previously stored in the main class or elsewhere.
- The fields of a class are much easier to document than the elements of an array.

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
