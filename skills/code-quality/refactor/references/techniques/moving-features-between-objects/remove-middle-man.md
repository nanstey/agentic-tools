# Remove Middle Man

## Metadata

- `id`: `remove-middle-man`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/remove-middle-man

## Problem

A class has too many methods that delegate to other objects.

## Solution

Delete these methods and force the client to call the end methods directly.

## When To Apply

A class has too many methods that delegate to other objects. To describe this technique, we’ll use the terms from Hide Delegate , which are: Server is the object to which the client has direct access.

## Why Refactor

To describe this technique, we’ll use the terms from Hide Delegate , which are: Server is the object to which the client has direct access.

## How To Apply

- Create a getter for accessing the delegate-class object from the server-class object.
- Replace calls to delegating methods in the server-class with direct calls for methods in the delegate-class .

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

- None.

### Helps Refactoring

- None.

### Eliminates Smell

- None.
