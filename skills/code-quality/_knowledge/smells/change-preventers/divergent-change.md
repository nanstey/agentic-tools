# Divergent Change

## Metadata

- `id`: `divergent-change`
- `category`: `Change Preventers` (`change-preventers`)
- `source`: https://refactoring.guru/smells/divergent-change

## Signs And Symptoms

You find yourself having to change many unrelated methods when you make changes to a class.

## Reasons For The Problem

Often these divergent modifications are due to poor program structure or "copypasta programming”.

## Treatment Summary

Split up the behavior of the class via Extract Class .

## Treatment Techniques

- Split up the behavior of the class via Extract Class .
- If different classes have the same behavior, you may want to combine the classes through inheritance ( Extract Superclass and Extract Subclass ).

## Payoff

- Improves code organization.
- Reduces code duplication.
- Simplifies support.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Extract Class` (`extract-class`)
- `Extract Superclass` (`extract-superclass`)
- `Extract Subclass` (`extract-subclass`)

## Related Smells

- None curated yet.
