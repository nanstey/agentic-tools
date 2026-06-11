# Long Parameter List

## Metadata

- `id`: `long-parameter-list`
- `category`: `Bloaters` (`bloaters`)
- `source`: https://refactoring.guru/smells/long-parameter-list

## Signs And Symptoms

More than three or four parameters for a method.

## Reasons For The Problem

A long list of parameters might happen after several types of algorithms are merged in a single method.

## Treatment Summary

Check what values are passed to parameters.

## Treatment Techniques

- Check what values are passed to parameters. If some of the arguments are results of method calls of another object, use Replace Parameter with Method Call . This object can be placed in the field of its own class or passed as a method parameter.
- Instead of passing a group of data received from another object as parameters, pass the object itself to the method, by using Preserve Whole Object .
- But if these parameters are coming from different sources, you can pass them as a single parameter object via Introduce Parameter Object .

## Payoff

- More readable, shorter code.
- Refactoring may reveal previously unnoticed duplicate code.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Replace Parameter with Method Call` (`replace-parameter-with-method-call`)
- `Preserve Whole Object` (`preserve-whole-object`)
- `Introduce Parameter Object` (`introduce-parameter-object`)

## Related Smells

- None curated yet.
