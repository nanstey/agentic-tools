# Middle Man

## Metadata

- `id`: `middle-man`
- `category`: `Couplers` (`couplers`)
- `source`: https://refactoring.guru/smells/middle-man

## Signs And Symptoms

If a class performs only one action, delegating work to another class, why does it exist at all?

## Reasons For The Problem

This smell can be the result of overzealous elimination of Message Chains .

## Treatment Summary

If most of a method’s classes delegate to another class, Remove Middle Man is in order.

## Treatment Techniques

- If most of a method’s classes delegate to another class, Remove Middle Man is in order.

## Payoff

- Less bulky code.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Remove Middle Man` (`remove-middle-man`)

## Related Smells

- None curated yet.
