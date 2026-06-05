# Lazy Class

## Metadata

- `id`: `lazy-class`
- `category`: `Dispensables` (`dispensables`)
- `source`: https://refactoring.guru/smells/lazy-class

## Signs And Symptoms

Understanding and maintaining classes always costs time and money.

## Reasons For The Problem

Perhaps a class was designed to be fully functional but after some of the refactoring it has become ridiculously small.

## Treatment Summary

Components that are near-useless should be given the Inline Class treatment.

## Treatment Techniques

- Components that are near-useless should be given the Inline Class treatment.
- For subclasses with few functions, try Collapse Hierarchy .

## Payoff

- Reduced code size.
- Easier maintenance.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Inline Class` (`inline-class`)
- `Collapse Hierarchy` (`collapse-hierarchy`)

## Related Smells

- None curated yet.
