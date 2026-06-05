# Alternative Classes with Different Interfaces

## Metadata

- `id`: `alternative-classes-with-different-interfaces`
- `category`: `Object-Orientation Abusers` (`object-orientation-abusers`)
- `source`: https://refactoring.guru/smells/alternative-classes-with-different-interfaces

## Signs And Symptoms

Two classes perform identical functions but have different method names.

## Reasons For The Problem

The programmer who created one of the classes probably didn’t know that a functionally equivalent class already existed.

## Treatment Summary

Try to put the interface of classes in terms of a common denominator: Rename Method s to make them identical in all alternative classes.

## Treatment Techniques

- Rename Method s to make them identical in all alternative classes.
- Move Method , Add Parameter and Parameterize Method to make the signature and implementation of methods the same.
- If only part of the functionality of the classes is duplicated, try using Extract Superclass . In this case, the existing classes will become subclasses.
- After you have determined which treatment method to use and implemented it, you may be able to delete one of the classes.

## Payoff

- You get rid of unnecessary duplicated code, making the resulting code less bulky.
- Code becomes more readable and understandable (you no longer have to guess the reason for creation of a second class performing the exact same functions as the first one).

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Rename Method` (`rename-method`)
- `Move Method` (`move-method`)
- `Add Parameter` (`add-parameter`)
- `Parameterize Method` (`parameterize-method`)
- `Extract Superclass` (`extract-superclass`)

## Related Smells

- None curated yet.
