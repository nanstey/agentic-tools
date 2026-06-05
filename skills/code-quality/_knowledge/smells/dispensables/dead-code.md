# Dead Code

## Metadata

- `id`: `dead-code`
- `category`: `Dispensables` (`dispensables`)
- `source`: https://refactoring.guru/smells/dead-code

## Signs And Symptoms

A variable, parameter, field, method or class is no longer used (usually because it’s obsolete).

## Reasons For The Problem

When requirements for the software have changed or corrections have been made, nobody had time to clean up the old code.

## Treatment Summary

The quickest way to find dead code is to use a good IDE .

## Treatment Techniques

- Delete unused code and unneeded files.
- In the case of an unnecessary class, Inline Class or Collapse Hierarchy can be applied if a subclass or superclass is used.
- To remove unneeded parameters, use Remove Parameter .

## Payoff

- Reduced code size.
- Simpler support.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Inline Class` (`inline-class`)
- `Collapse Hierarchy` (`collapse-hierarchy`)
- `Remove Parameter` (`remove-parameter`)

## Related Smells

- None curated yet.
