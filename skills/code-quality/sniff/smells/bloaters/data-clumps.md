# Data Clumps

## Metadata

- `id`: `data-clumps`
- `category`: `Bloaters` (`bloaters`)
- `source`: https://refactoring.guru/smells/data-clumps

## Signs And Symptoms

Sometimes different parts of the code contain identical groups of variables (such as parameters for connecting to a database).

## Reasons For The Problem

Often these data groups are due to poor program structure or "copypasta programming”.

## Treatment Summary

If repeating data comprises the fields of a class, use Extract Class to move the fields to their own class.

## Treatment Techniques

- If repeating data comprises the fields of a class, use Extract Class to move the fields to their own class.
- If the same data clumps are passed in the parameters of methods, use Introduce Parameter Object to set them off as a class.
- If some of the data is passed to other methods, think about passing the entire data object to the method instead of just individual fields. Preserve Whole Object will help with this.
- Look at the code used by these fields. It may be a good idea to move this code to a data class.

## Payoff

- Improves understanding and organization of code. Operations on particular data are now gathered in a single place, instead of haphazardly throughout the code.
- Reduces code size.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Extract Class` (`extract-class`)
- `Introduce Parameter Object` (`introduce-parameter-object`)
- `Preserve Whole Object` (`preserve-whole-object`)

## Related Smells

- None curated yet.
