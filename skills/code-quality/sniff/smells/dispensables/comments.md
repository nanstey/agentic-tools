# Comments

## Metadata

- `id`: `comments`
- `category`: `Dispensables` (`dispensables`)
- `source`: https://refactoring.guru/smells/comments

## Signs And Symptoms

A method is filled with explanatory comments.

## Reasons For The Problem

Comments are usually created with the best of intentions, when the author realizes that his or her code isn’t intuitive or obvious.

## Treatment Summary

If a comment is intended to explain a complex expression, the expression should be split into understandable subexpressions using Extract Variable .

## Treatment Techniques

- If a comment is intended to explain a complex expression, the expression should be split into understandable subexpressions using Extract Variable .
- If a comment explains a section of code, this section can be turned into a separate method via Extract Method . The name of the new method can be taken from the comment text itself, most likely.
- If a method has already been extracted, but comments are still necessary to explain what the method does, give the method a self-explanatory name. Use Rename Method for this.
- If you need to assert rules about a state that’s necessary for the system to work, use Introduce Assertion .

## Payoff

- Code becomes more intuitive and obvious.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Extract Variable` (`extract-variable`)
- `Extract Method` (`extract-method`)
- `Rename Method` (`rename-method`)
- `Introduce Assertion` (`introduce-assertion`)

## Related Smells

- None curated yet.
