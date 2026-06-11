# Speculative Generality

## Metadata

- `id`: `speculative-generality`
- `category`: `Dispensables` (`dispensables`)
- `source`: https://refactoring.guru/smells/speculative-generality

## Signs And Symptoms

There’s an unused class, method, field or parameter.

## Reasons For The Problem

Sometimes code is created “just in case” to support anticipated future features that never get implemented.

## Treatment Summary

For removing unused abstract classes, try Collapse Hierarchy .

## Treatment Techniques

- For removing unused abstract classes, try Collapse Hierarchy .
- Unnecessary delegation of functionality to another class can be eliminated via Inline Class .
- Unused methods? Use Inline Method to get rid of them.
- Methods with unused parameters should be given a look with the help of Remove Parameter .
- Unused fields can be deleted.

## Payoff

- Slimmer code.
- Easier support.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Collapse Hierarchy` (`collapse-hierarchy`)
- `Inline Class` (`inline-class`)
- `Inline Method` (`inline-method`)
- `Remove Parameter` (`remove-parameter`)

## Related Smells

- None curated yet.
