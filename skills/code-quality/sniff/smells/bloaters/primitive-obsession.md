# Primitive Obsession

## Metadata

- `id`: `primitive-obsession`
- `category`: `Bloaters` (`bloaters`)
- `source`: https://refactoring.guru/smells/primitive-obsession

## Signs And Symptoms

Use of primitives instead of small objects for simple tasks (such as currency, ranges, special strings for phone numbers, etc.) Use of constants for coding information (such as a constant USER_ADMIN_ROLE = 1 for referring to users with administrator rights.) Use of string constants as field names for use in data arrays.

## Reasons For The Problem

Like most other smells, primitive obsessions are born in moments of weakness.

## Treatment Summary

If you have a large variety of primitive fields, it may be possible to logically group some of them into their own class.

## Treatment Techniques

- If you have a large variety of primitive fields, it may be possible to logically group some of them into their own class. Even better, move the behavior associated with this data into the class too. For this task, try Replace Data Value with Object .
- If the values of primitive fields are used in method parameters, go with Introduce Parameter Object or Preserve Whole Object .
- When complicated data is coded in variables, use Replace Type Code with Class , Replace Type Code with Subclasses or Replace Type Code with State/Strategy .
- If there are arrays among the variables, use Replace Array with Object .

## Payoff

- Code becomes more flexible thanks to use of objects instead of primitives.
- Better understandability and organization of code. Operations on particular data are in the same place, instead of being scattered. No more guessing about the reason for all these strange constants and why they’re in an array.
- Easier finding of duplicate code.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Replace Data Value with Object` (`replace-data-value-with-object`)
- `Introduce Parameter Object` (`introduce-parameter-object`)
- `Preserve Whole Object` (`preserve-whole-object`)
- `Replace Type Code with Class` (`replace-type-code-with-class`)
- `Replace Type Code with Subclasses` (`replace-type-code-with-subclasses`)
- `Replace Type Code with State/Strategy` (`replace-type-code-with-state-strategy`)
- `Replace Array with Object` (`replace-array-with-object`)

## Related Smells

- None curated yet.
