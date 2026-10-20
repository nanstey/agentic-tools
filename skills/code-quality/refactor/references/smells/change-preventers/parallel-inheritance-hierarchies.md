# Parallel Inheritance Hierarchies

## Metadata

- `id`: `parallel-inheritance-hierarchies`
- `category`: `Change Preventers` (`change-preventers`)
- `source`: https://refactoring.guru/smells/parallel-inheritance-hierarchies

## Signs And Symptoms

Whenever you create a subclass for a class, you find yourself needing to create a subclass for another class.

## Reasons For The Problem

All was well as long as the hierarchy stayed small.

## Treatment Summary

You may de-duplicate parallel class hierarchies in two steps.

## Treatment Techniques

- You may de-duplicate parallel class hierarchies in two steps. First, make instances of one hierarchy refer to instances of another hierarchy. Then, remove the hierarchy in the referred class, by using Move Method and Move Field .

## Payoff

- Reduces code duplication.
- Can improve organization of code.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Move Method` (`move-method`)
- `Move Field` (`move-field`)

## Related Smells

- None curated yet.
