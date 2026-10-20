# Feature Envy

## Metadata

- `id`: `feature-envy`
- `category`: `Couplers` (`couplers`)
- `source`: https://refactoring.guru/smells/feature-envy

## Signs And Symptoms

A method accesses the data of another object more than its own data.

## Reasons For The Problem

This smell may occur after fields are moved to a data class.

## Treatment Summary

As a basic rule, if things change at the same time, you should keep them in the same place.

## Treatment Techniques

- If a method clearly should be moved to another place, use Move Method .
- If only part of a method accesses the data of another object, use Extract Method to move the part in question.
- If a method uses functions from several other classes, first determine which class contains most of the data used. Then place the method in this class along with the other data. Alternatively, use Extract Method to split the method into several parts that can be placed in different places in different classes.

## Payoff

- Less code duplication (if the data handling code is put in a central place).
- Better code organization (methods for handling data are next to the actual data).

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Move Method` (`move-method`)
- `Extract Method` (`extract-method`)

## Related Smells

- None curated yet.
