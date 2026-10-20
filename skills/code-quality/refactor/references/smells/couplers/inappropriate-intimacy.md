# Inappropriate Intimacy

## Metadata

- `id`: `inappropriate-intimacy`
- `category`: `Couplers` (`couplers`)
- `source`: https://refactoring.guru/smells/inappropriate-intimacy

## Signs And Symptoms

One class uses the internal fields and methods of another class.

## Reasons For The Problem

Keep a close eye on classes that spend too much time together.

## Treatment Summary

The simplest solution is to use Move Method and Move Field to move parts of one class to the class in which those parts are used.

## Treatment Techniques

- The simplest solution is to use Move Method and Move Field to move parts of one class to the class in which those parts are used. But this works only if the first class truly doesn’t need these parts.
- Another solution is to use Extract Class and Hide Delegate on the class to make the code relations “official”.
- If the classes are mutually interdependent, you should use Change Bidirectional Association to Unidirectional .
- If this “intimacy” is between a subclass and the superclass, consider Replace Delegation with Inheritance .

## Payoff

- Improves code organization.
- Simplifies support and code reuse.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Move Method` (`move-method`)
- `Move Field` (`move-field`)
- `Extract Class` (`extract-class`)
- `Hide Delegate` (`hide-delegate`)
- `Change Bidirectional Association to Unidirectional` (`change-bidirectional-association-to-unidirectional`)
- `Replace Delegation with Inheritance` (`replace-delegation-with-inheritance`)

## Related Smells

- None curated yet.
