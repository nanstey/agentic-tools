# Substitute Algorithm

## Metadata

- `id`: `substitute-algorithm`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/substitute-algorithm

## Problem

So you want to replace an existing algorithm with a new one?

## Solution

Replace the body of the method that implements the algorithm with a new algorithm.

## When To Apply

So you want to replace an existing algorithm with a new one? Gradual refactoring isn’t the only method for improving a program.

## Why Refactor

Gradual refactoring isn’t the only method for improving a program.

## How To Apply

- Make sure that you have simplified the existing algorithm as much as possible. Move unimportant code to other methods using Extract Method . The fewer moving parts in your algorithm, the easier it’s to replace.
- Create your new algorithm in a new method. Replace the old algorithm with the new one and start testing the program.
- If the results don’t match, return to the old implementation and compare the results. Identify the causes of the discrepancy. While the cause is often an error in the old algorithm, it’s more likely due to something not working in the new one.
- When all tests are successfully completed, delete the old algorithm for good!

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
