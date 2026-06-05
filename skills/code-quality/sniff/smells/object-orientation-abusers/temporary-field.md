# Temporary Field

## Metadata

- `id`: `temporary-field`
- `category`: `Object-Orientation Abusers` (`object-orientation-abusers`)
- `source`: https://refactoring.guru/smells/temporary-field

## Signs And Symptoms

Temporary fields get their values (and thus are needed by objects) only under certain circumstances.

## Reasons For The Problem

Oftentimes, temporary fields are created for use in an algorithm that requires a large amount of inputs.

## Treatment Summary

Temporary fields and all code operating on them can be put in a separate class via Extract Class .

## Treatment Techniques

- Temporary fields and all code operating on them can be put in a separate class via Extract Class . In other words, you’re creating a method object, achieving the same result as if you would perform Replace Method with Method Object .
- Introduce Null Object and integrate it in place of the conditional code which was used to check the temporary field values for existence.

## Payoff

- Better code clarity and organization.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Extract Class` (`extract-class`)
- `Replace Method with Method Object` (`replace-method-with-method-object`)
- `Introduce Null Object` (`introduce-null-object`)

## Related Smells

- None curated yet.
