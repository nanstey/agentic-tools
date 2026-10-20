# Split Temporary Variable

## Metadata

- `id`: `split-temporary-variable`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/split-temporary-variable

## Problem

You have a local variable that’s used to store various intermediate values inside a method (except for cycle variables).

## Solution

Use different variables for different values.

## When To Apply

You have a local variable that’s used to store various intermediate values inside a method (except for cycle variables). If you’re skimping on the number of variables inside a function and reusing them for various unrelated purposes, you’re sure to encounter problems as soon as you need to make changes to the code containing the variables.

## Why Refactor

If you’re skimping on the number of variables inside a function and reusing them for various unrelated purposes, you’re sure to encounter problems as soon as you need to make changes to the code containing the variables.

## How To Apply

- Find the first place in the code where the variable is given a value. Here you should rename the variable with a name that corresponds to the value being assigned.
- Use the new name instead of the old one in places where this value of the variable is used.
- Repeat as needed for places where the variable is assigned a different value.

## Benefits

- Each component of the program code should be responsible for one and one thing only. This makes it much easier to maintain the code, since you can easily replace any particular thing without fear of unintended effects.
- Code becomes more readable. If a variable was created long ago in a rush, it probably has a name that doesn’t explain anything: k , a2 , value , etc. But you can fix this situation by naming the new variables in an understandable, self-explanatory way. Such names might resemble customerTaxValue , cityUnemploymentRate , clientSalutationString and the like.
- This refactoring technique is useful if you anticipate using Extract Method later.

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

- `Extract Variable` (`extract-variable`) -> `techniques/composing-methods/extract-variable.md`
- `Remove Assignments to Parameters` (`remove-assignments-to-parameters`) -> `techniques/composing-methods/remove-assignments-to-parameters.md`

### Helps Refactoring

- `Extract Method` (`extract-method`) -> `techniques/composing-methods/extract-method.md`

### Eliminates Smell

- None.
