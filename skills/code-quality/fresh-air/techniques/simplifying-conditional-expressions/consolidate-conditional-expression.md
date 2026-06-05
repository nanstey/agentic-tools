# Consolidate Conditional Expression

## Metadata

- `id`: `consolidate-conditional-expression`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/consolidate-conditional-expression

## Problem

You have multiple conditionals that lead to the same result or action.

## Solution

Consolidate all these conditionals in a single expression.

## When To Apply

You have multiple conditionals that lead to the same result or action. Your code contains many alternating operators that perform identical actions.

## Why Refactor

Your code contains many alternating operators that perform identical actions.

## How To Apply

- Consolidate the conditionals in a single expression by using and and or . As a general rule when consolidating: Nested conditionals are joined using and .
- Consecutive conditionals are joined with or .
- Perform Extract Method on the operator conditions and give the method a name that reflects the expression’s purpose.

## Benefits

- Eliminates duplicate control flow code. Combining multiple conditionals that have the same “destination” helps to show that you’re doing only one complicated check leading to one action.
- By consolidating all operators, you can now isolate this complex expression in a new method with a name that explains the conditional’s purpose.

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
