# Shotgun Surgery

## Metadata

- `id`: `shotgun-surgery`
- `category`: `Change Preventers` (`change-preventers`)
- `source`: https://refactoring.guru/smells/shotgun-surgery

## Signs And Symptoms

Making any modifications requires that you make many small changes to many different classes.

## Reasons For The Problem

A single responsibility has been split up among a large number of classes.

## Treatment Summary

Use Move Method and Move Field to move existing class behaviors into a single class.

## Treatment Techniques

- Use Move Method and Move Field to move existing class behaviors into a single class. If there’s no class appropriate for this, create a new one.
- If moving code to the same class leaves the original classes almost empty, try to get rid of these now-redundant classes via Inline Class .

## Payoff

- Better organization.
- Less code duplication.
- Easier maintenance.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Move Method` (`move-method`)
- `Move Field` (`move-field`)
- `Inline Class` (`inline-class`)

## Related Smells

- None curated yet.
