# Remove Assignments to Parameters

## Metadata

- `id`: `remove-assignments-to-parameters`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/remove-assignments-to-parameters

## Problem

Some value is assigned to a parameter inside method’s body.

## Solution

Use a local variable instead of a parameter.

## When To Apply

Some value is assigned to a parameter inside method’s body. The reasons for this refactoring are the same as for Split Temporary Variable , but in this case we’re dealing with a parameter, not a local variable.

## Why Refactor

The reasons for this refactoring are the same as for Split Temporary Variable , but in this case we’re dealing with a parameter, not a local variable.

## How To Apply

- Create a local variable and assign the initial value of your parameter.
- In all method code that follows this line, replace the parameter with your new local variable.

## Benefits

- Each element of the program should be responsible for only one thing. This makes code maintenance much easier going forward, since you can safely replace code without any side effects.
- This refactoring helps to extract repetitive code to separate methods .

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

- `Split Temporary Variable` (`split-temporary-variable`) -> `techniques/composing-methods/split-temporary-variable.md`

### Helps Refactoring

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`

### Eliminates Smell

- None.
