# Hide Delegate

## Metadata

- `id`: `hide-delegate`
- `category`: `Moving Features between Objects` (`moving-features-between-objects`)
- `source`: https://refactoring.guru/hide-delegate

## Problem

The client gets object B from a field or method of object А.

## Solution

Create a new method in class A that delegates the call to object B.

## When To Apply

The client gets object B from a field or method of object А. To start with, let’s look at terminology: Server is the object to which the client has direct access.

## Why Refactor

To start with, let’s look at terminology: Server is the object to which the client has direct access.

## How To Apply

- For each method of the delegate-class called by the client, create a method in the server-class that delegates the call to the delegate-class .
- Change the client code so that it calls the methods of the server-class .
- If your changes free the client from needing the delegate-class , you can remove the access method to the delegate-class from the server-class (the method that was originally used to get the delegate-class ).

## Benefits

- Hides delegation from the client. The less that the client code needs to know about the details of relationships between objects, the easier it’s to make changes to your program.

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
