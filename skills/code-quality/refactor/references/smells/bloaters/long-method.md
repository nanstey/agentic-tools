# Long Method

## Metadata

- `id`: `long-method`
- `category`: `Bloaters` (`bloaters`)
- `source`: https://refactoring.guru/smells/long-method

## Signs And Symptoms

A method contains too many lines of code.

## Reasons For The Problem

Like the Hotel California, something is always being added to a method but nothing is ever taken out.

## Treatment Summary

As a rule of thumb, if you feel the need to comment on something inside a method, you should take this code and put it in a new method.

## Treatment Techniques

- To reduce the length of a method body, use Extract Method .
- If local variables and parameters interfere with extracting a method, use Replace Temp with Query , Introduce Parameter Object or Preserve Whole Object .
- If none of the previous recipes help, try moving the entire method to a separate object via Replace Method with Method Object .
- Conditional operators and loops are a good clue that code can be moved to a separate method. For conditionals, use Decompose Conditional . If loops are in the way, try Extract Method .

## Payoff

- Among all types of object-oriented code, classes with short methods live longest. The longer a method or function is, the harder it becomes to understand and maintain it.
- In addition, long methods offer the perfect hiding place for unwanted duplicate code.

## Performance Notes

Does an increase in the number of methods hurt performance, as many people claim?

## Related Refactorings

- `Extract Method` (`extract-method`)
- `Replace Temp with Query` (`replace-temp-with-query`)
- `Introduce Parameter Object` (`introduce-parameter-object`)
- `Preserve Whole Object` (`preserve-whole-object`)
- `Replace Method with Method Object` (`replace-method-with-method-object`)
- `Decompose Conditional` (`decompose-conditional`)

## Related Smells

- None curated yet.
