# Incomplete Library Class

## Metadata

- `id`: `incomplete-library-class`
- `category`: `Couplers` (`couplers`)
- `source`: https://refactoring.guru/smells/incomplete-library-class

## Signs And Symptoms

Sooner or later, libraries stop meeting user needs.

## Reasons For The Problem

The author of the library hasn’t provided the features you need or has refused to implement them.

## Treatment Summary

To introduce a few methods to a library class, use Introduce Foreign Method .

## Treatment Techniques

- To introduce a few methods to a library class, use Introduce Foreign Method .
- For big changes in a class library, use Introduce Local Extension .

## Payoff

- Reduces code duplication (instead of creating your own library from scratch, you can still piggy-back off an existing one).

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Introduce Foreign Method` (`introduce-foreign-method`)
- `Introduce Local Extension` (`introduce-local-extension`)

## Related Smells

- None curated yet.
