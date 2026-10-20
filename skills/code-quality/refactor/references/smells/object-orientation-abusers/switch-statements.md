# Switch Statements

## Metadata

- `id`: `switch-statements`
- `category`: `Object-Orientation Abusers` (`object-orientation-abusers`)
- `source`: https://refactoring.guru/smells/switch-statements

## Signs And Symptoms

You have a complex switch operator or sequence of if statements.

## Reasons For The Problem

Relatively rare use of switch and case operators is one of the hallmarks of object-oriented code.

## Treatment Summary

To isolate switch and put it in the right class, you may need Extract Method and then Move Method .

## Treatment Techniques

- To isolate switch and put it in the right class, you may need Extract Method and then Move Method .
- If a switch is based on type code, such as when the program’s runtime mode is switched, use Replace Type Code with Subclasses or Replace Type Code with State/Strategy .
- After specifying the inheritance structure, use Replace Conditional with Polymorphism .
- If there aren’t too many conditions in the operator and they all call same method with different parameters, polymorphism will be superfluous. If this case, you can break that method into multiple smaller methods with Replace Parameter with Explicit Methods and change the switch accordingly.
- If one of the conditional options is null , use Introduce Null Object .

## Payoff

- Improved code organization.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Extract Method` (`extract-method`)
- `Move Method` (`move-method`)
- `Replace Type Code with Subclasses` (`replace-type-code-with-subclasses`)
- `Replace Type Code with State/Strategy` (`replace-type-code-with-state-strategy`)
- `Replace Conditional with Polymorphism` (`replace-conditional-with-polymorphism`)
- `Replace Parameter with Explicit Methods` (`replace-parameter-with-explicit-methods`)
- `Introduce Null Object` (`introduce-null-object`)

## Related Smells

- None curated yet.
