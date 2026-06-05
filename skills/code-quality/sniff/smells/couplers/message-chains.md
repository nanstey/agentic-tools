# Message Chains

## Metadata

- `id`: `message-chains`
- `category`: `Couplers` (`couplers`)
- `source`: https://refactoring.guru/smells/message-chains

## Signs And Symptoms

In code you see a series of calls resembling $a->b()->c()->d()

## Reasons For The Problem

A message chain occurs when a client requests another object, that object requests yet another one, and so on.

## Treatment Summary

To delete a message chain, use Hide Delegate .

## Treatment Techniques

- To delete a message chain, use Hide Delegate .
- Sometimes it’s better to think of why the end object is being used. Perhaps it would make sense to use Extract Method for this functionality and move it to the beginning of the chain, by using Move Method .

## Payoff

- Reduces dependencies between classes of a chain.
- Reduces the amount of bloated code.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Hide Delegate` (`hide-delegate`)
- `Extract Method` (`extract-method`)
- `Move Method` (`move-method`)

## Related Smells

- None curated yet.
