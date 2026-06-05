# Extract Variable

## Metadata

- `id`: `extract-variable`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/extract-variable

## Problem

You have an expression that’s hard to understand.

## Solution

Place the result of the expression or its parts in separate variables that are self-explanatory.

## When To Apply

You have an expression that’s hard to understand. The main reason for extracting variables is to make a complex expression more understandable, by dividing it into its intermediate parts.

## Why Refactor

The main reason for extracting variables is to make a complex expression more understandable, by dividing it into its intermediate parts.

## How To Apply

- Insert a new line before the relevant expression and declare a new variable there. Assign part of the complex expression to this variable.
- Replace that part of the expression with the new variable.
- Repeat the process for all complex parts of the expression.

## Benefits

- More readable code! Try to give the extracted variables good names that announce the variable’s purpose loud and clear. More readability, fewer long-winded comments. Go for names like customerTaxValue , cityUnemploymentRate , clientSalutationString , etc.

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

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
