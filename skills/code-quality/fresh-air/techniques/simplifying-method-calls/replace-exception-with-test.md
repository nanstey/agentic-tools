# Replace Exception with Test

## Metadata

- `id`: `replace-exception-with-test`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/replace-exception-with-test

## Problem

You throw an exception in a place where a simple test would do the job?

## Solution

Replace the exception with a condition test.

## When To Apply

You throw an exception in a place where a simple test would do the job? Exceptions should be used to handle irregular behavior related to an unexpected error.

## Why Refactor

Exceptions should be used to handle irregular behavior related to an unexpected error.

## How To Apply

- Create a conditional for an edge case and move it before the try/catch block.
- Move code from the catch section inside this conditional.
- In the catch section, place the code for throwing a usual unnamed exception and run all the tests.
- If no exceptions were thrown during the tests, get rid of the try / catch operator.

## Benefits

- A simple conditional can sometimes be more obvious than exception handling code.

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

- `Replace Error Code with Exception` (`replace-error-code-with-exception`) -> `techniques/simplifying-method-calls/replace-error-code-with-exception.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
