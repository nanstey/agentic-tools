# Replace Magic Number with Symbolic Constant

## Metadata

- `id`: `replace-magic-number-with-symbolic-constant`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/replace-magic-number-with-symbolic-constant

## Problem

Your code uses a number that has a certain meaning to it.

## Solution

Replace this number with a constant that has a human-readable name explaining the meaning of the number.

## When To Apply

Your code uses a number that has a certain meaning to it. A magic number is a numeric value that’s encountered in the source but has no obvious meaning.

## Why Refactor

A magic number is a numeric value that’s encountered in the source but has no obvious meaning.

## How To Apply

- Declare a constant and assign the value of the magic number to it.
- Find all mentions of the magic number.
- For each of the numbers that you find, double-check that the magic number in this particular case corresponds to the purpose of the constant. If yes, replace the number with your constant. This is an important step, since the same number can mean absolutely different things (and replaced with different constants, as the case may be).

## Benefits

- The symbolic constant can serve as live documentation of the meaning of its value.
- It’s much easier to change the value of a constant than to search for this number throughout the entire codebase, without the risk of accidentally changing the same number used elsewhere for a different purpose.
- Reduce duplicate use of a number or string in the code. This is especially important when the value is complicated and long (such as 3.14159 or 0xCAFEBABE ).

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
