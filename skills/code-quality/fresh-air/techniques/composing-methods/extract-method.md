# Extract Method

## Metadata

- `id`: `extract-method`
- `category`: `Composing Methods` (`composing-methods`)
- `source`: https://refactoring.guru/extract-method

## Problem

You have a code fragment that can be grouped together.

## Solution

Move this code to a separate new method (or function) and replace the old code with a call to the method.

## When To Apply

You have a code fragment that can be grouped together. The more lines found in a method, the harder it’s to figure out what the method does.

## Why Refactor

The more lines found in a method, the harder it’s to figure out what the method does.

## How To Apply

- Create a new method and name it in a way that makes its purpose self-evident.
- Copy the relevant code fragment to your new method. Delete the fragment from its old location and put a call for the new method there instead. Find all variables used in this code fragment. If they’re declared inside the fragment and not used outside of it, leave them unchanged. They’ll become local variables for the new method.
- If the variables are declared prior to the code that you’re extracting, you will need to pass these variables to the parameters of your new method in order to use the values previously contained in them. Sometimes it’s easier to get rid of these variables by resorting to Replace Temp with Query .
- If you see that a local variable changes in your extracted code in some way, this may mean that this changed value will be needed later in your main method. Double-check! And if this is indeed the case, return the value of this variable to the main method to keep everything functioning.

## Benefits

- More readable code! Be sure to give the new method a name that describes the method’s purpose: createOrder() , renderCustomerInfo() , etc.
- Less code duplication. Often the code that’s found in a method can be reused in other places in your program. So you can replace duplicates with calls to your new method.
- Isolates independent parts of code, meaning that errors are less likely (such as if the wrong variable is modified).

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

- `Move Method` (`move-method`) -> `techniques/moving-features-between-objects/move-method.md`

### Helps Refactoring

- `Form Template Method` (`form-template-method`) -> `techniques/dealing-with-generalization/form-template-method.md`
- `Introduce Parameter Object` (`introduce-parameter-object`) -> `techniques/simplifying-method-calls/introduce-parameter-object.md`
- `Parameterize Method` (`parameterize-method`) -> `techniques/simplifying-method-calls/parameterize-method.md`

### Eliminates Smell

- None.
