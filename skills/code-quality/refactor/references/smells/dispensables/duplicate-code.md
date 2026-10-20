# Duplicate Code

## Metadata

- `id`: `duplicate-code`
- `category`: `Dispensables` (`dispensables`)
- `source`: https://refactoring.guru/smells/duplicate-code

## Signs And Symptoms

Two code fragments look almost identical.

## Reasons For The Problem

Duplication usually occurs when multiple programmers are working on different parts of the same program at the same time.

## Treatment Summary

If the same code is found in two or more methods in the same class: use Extract Method and place calls for the new method in both places.

## Treatment Techniques

- If the same code is found in two or more methods in the same class: use Extract Method and place calls for the new method in both places.
- If the same code is found in two subclasses of the same level: Use Extract Method for both classes, followed by Pull Up Field for the fields used in the method that you’re pulling up.
- If the duplicate code is inside a constructor, use Pull Up Constructor Body .
- If the duplicate code is similar but not completely identical, use Form Template Method .
- If two methods do the same thing but use different algorithms, select the best algorithm and apply Substitute Algorithm .
- If duplicate code is found in two different classes: If the classes aren’t part of a hierarchy, use Extract Superclass in order to create a single superclass for these classes that maintains all the previous functionality.
- If it’s difficult or impossible to create a superclass, use Extract Class in one class and use the new component in the other.
- If a large number of conditional expressions are present and perform the same code (differing only in their conditions), merge these operators into a single condition using Consolidate Conditional Expression and use Extract Method to place the condition in a separate method with an easy-to-understand name.
- If the same code is performed in all branches of a conditional expression: place the identical code outside of the condition tree by using Consolidate Duplicate Conditional Fragments .

## Payoff

- Merging duplicate code simplifies the structure of your code and makes it shorter.
- Simplification + shortness = code that’s easier to simplify and cheaper to support.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Extract Method` (`extract-method`)
- `Pull Up Field` (`pull-up-field`)
- `Pull Up Constructor Body` (`pull-up-constructor-body`)
- `Form Template Method` (`form-template-method`)
- `Substitute Algorithm` (`substitute-algorithm`)
- `Extract Superclass` (`extract-superclass`)
- `Extract Class` (`extract-class`)
- `Consolidate Conditional Expression` (`consolidate-conditional-expression`)
- `Consolidate Duplicate Conditional Fragments` (`consolidate-duplicate-conditional-fragments`)

## Related Smells

- None curated yet.
