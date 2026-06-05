# Collapse Hierarchy

## Metadata

- `id`: `collapse-hierarchy`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/collapse-hierarchy

## Problem

You have a class hierarchy in which a subclass is practically the same as its superclass.

## Solution

Merge the subclass and superclass.

## When To Apply

You have a class hierarchy in which a subclass is practically the same as its superclass. Your program has grown over time and a subclass and superclass have become practically the same.

## Why Refactor

Your program has grown over time and a subclass and superclass have become practically the same.

## How To Apply

- Select which class is easier to remove: the superclass or its subclass.
- Use Pull Up Field and Pull Up Method if you decide to get rid of the subclass. If you choose to eliminate the superclass, go for Push Down Field and Push Down Method .
- Replace all uses of the class that you’re deleting with the class to which the fields and methods are to be migrated. Often this will be code for creating classes, variable and parameter typing, and documentation in code comments.
- Delete the empty class.

## Benefits

- Program complexity is reduced. Fewer classes mean fewer things to keep straight in your head and fewer breakable moving parts to worry about during future code changes.
- Navigating through your code is easier when methods are defined in one class early. You don’t need to comb through the entire hierarchy to find a particular method.

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

- `Inline Class` (`inline-class`) -> `techniques/moving-features-between-objects/inline-class.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
