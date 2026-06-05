# Replace Parameter with Method Call

## Metadata

- `id`: `replace-parameter-with-method-call`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/replace-parameter-with-method-call

## Problem

Calling a query method and passing its results as the parameters of another method, while that method could call the query directly.

## Solution

Instead of passing the value through a parameter, try placing a query call inside the method body.

## When To Apply

Calling a query method and passing its results as the parameters of another method, while that method could call the query directly. A long list of parameters is hard to understand.

## Why Refactor

A long list of parameters is hard to understand.

## How To Apply

- Make sure that the value-getting code doesn’t use parameters from the current method, since they’ll be unavailable from inside another method. If so, moving the code isn’t possible.
- If the relevant code is more complicated than a single method or function call, use Extract Method to isolate this code in a new method and make the call simple.
- In the code of the main method, replace all references to the parameter being replaced with calls to the method that gets the value.
- Use Remove Parameter to eliminate the now-unused parameter.

## Benefits

- We get rid of unneeded parameters and simplify method calls. Such parameters are often created not for the project as it’s now, but with an eye for future needs that may never come.

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
