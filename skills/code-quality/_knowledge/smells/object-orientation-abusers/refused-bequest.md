# Refused Bequest

## Metadata

- `id`: `refused-bequest`
- `category`: `Object-Orientation Abusers` (`object-orientation-abusers`)
- `source`: https://refactoring.guru/smells/refused-bequest

## Signs And Symptoms

If a subclass uses only some of the methods and properties inherited from its parents, the hierarchy is off-kilter.

## Reasons For The Problem

Someone was motivated to create inheritance between classes only by the desire to reuse the code in a superclass.

## Treatment Summary

If inheritance makes no sense and the subclass really does have nothing in common with the superclass, eliminate inheritance in favor of Replace Inheritance with Delegation .

## Treatment Techniques

- If inheritance makes no sense and the subclass really does have nothing in common with the superclass, eliminate inheritance in favor of Replace Inheritance with Delegation .
- If inheritance is appropriate, get rid of unneeded fields and methods in the subclass. Extract all fields and methods needed by the subclass from the parent class, put them in a new superclass, and set both classes to inherit from it ( Extract Superclass ).

## Payoff

- Improves code clarity and organization. You will no longer have to wonder why the Dog class is inherited from the Chair class (even though they both have 4 legs).

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Replace Inheritance with Delegation` (`replace-inheritance-with-delegation`)
- `Extract Superclass` (`extract-superclass`)

## Related Smells

- None curated yet.
