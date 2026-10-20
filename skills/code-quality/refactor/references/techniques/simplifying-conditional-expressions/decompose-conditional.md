# Decompose Conditional

## Metadata

- `id`: `decompose-conditional`
- `category`: `Simplifying Conditional Expressions` (`simplifying-conditional-expressions`)
- `source`: https://refactoring.guru/decompose-conditional

## Problem

You have a complex conditional ( if-then / else or switch ).

## Solution

Decompose the complicated parts of the conditional into separate methods: the condition, then and else .

## When To Apply

You have a complex conditional ( if-then / else or switch ). The longer a piece of code is, the harder it’s to understand.

## Why Refactor

The longer a piece of code is, the harder it’s to understand.

## How To Apply

- Extract the conditional to a separate method via Extract Method .
- Repeat the process for the then and else blocks.

## Benefits

- By extracting conditional code to clearly named methods, you make life easier for the person who’ll be maintaining the code later (such as you, two months from now!).
- This refactoring technique is also applicable for short expressions in conditions. The string isSalaryDay() is much prettier and more descriptive than code for comparing dates.

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
