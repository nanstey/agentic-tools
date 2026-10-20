# Replace Error Code with Exception

## Metadata

- `id`: `replace-error-code-with-exception`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/replace-error-code-with-exception

## Problem

A method returns a special value that indicates an error?

## Solution

Throw an exception instead.

## When To Apply

A method returns a special value that indicates an error? Returning error codes is an obsolete holdover from procedural programming.

## Why Refactor

Returning error codes is an obsolete holdover from procedural programming.

## How To Apply

- Find all calls to a method that returns error codes and, instead of checking for an error code, wrap it in try / catch blocks.
- Inside the method, instead of returning an error code, throw an exception.
- Change the method signature so that it contains information about the exception being thrown ( @throws section).

## Benefits

- Frees code from a large number of conditionals for checking various error codes. Exception handlers are a much more succinct way to differentiate normal execution paths from abnormal ones.
- Exception classes can implement their own methods, thus containing part of the error handling functionality (such as for sending error messages).
- Unlike exceptions, error codes can’t be used in a constructor, since a constructor must return only a new object.

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
