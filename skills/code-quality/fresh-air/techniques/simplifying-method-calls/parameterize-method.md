# Parameterize Method

## Metadata

- `id`: `parameterize-method`
- `category`: `Simplifying Method Calls` (`simplifying-method-calls`)
- `source`: https://refactoring.guru/parameterize-method

## Problem

Multiple methods perform similar actions that are different only in their internal values, numbers or operations.

## Solution

Combine these methods by using a parameter that will pass the necessary special value.

## When To Apply

Multiple methods perform similar actions that are different only in their internal values, numbers or operations. If you have similar methods, you probably have duplicate code, with all the consequences that this entails.

## Why Refactor

If you have similar methods, you probably have duplicate code, with all the consequences that this entails.

## How To Apply

- Create a new method with a parameter and move it to the code that’s the same for all classes, by applying Extract Method . Note that sometimes only a certain part of methods is actually the same. In this case, refactoring consists of extracting only the same part to a new method.
- In the code of the new method, replace the special/differing value with a parameter.
- For each old method, find the places where it’s called, replacing these calls with calls to the new method that include a parameter. Then delete the old method.

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

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`
- `Form Template Method` (`form-template-method`) -> `techniques/dealing-with-generalization/form-template-method.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
