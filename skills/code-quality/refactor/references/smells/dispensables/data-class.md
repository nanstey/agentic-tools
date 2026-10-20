# Data Class

## Metadata

- `id`: `data-class`
- `category`: `Dispensables` (`dispensables`)
- `source`: https://refactoring.guru/smells/data-class

## Signs And Symptoms

A data class refers to a class that contains only fields and crude methods for accessing them (getters and setters).

## Reasons For The Problem

It’s a normal thing when a newly created class contains only a few public fields (and maybe even a handful of getters/setters).

## Treatment Summary

If a class contains public fields, use Encapsulate Field to hide them from direct access and require that access be performed via getters and setters only.

## Treatment Techniques

- If a class contains public fields, use Encapsulate Field to hide them from direct access and require that access be performed via getters and setters only.
- Use Encapsulate Collection for data stored in collections (such as arrays).
- Review the client code that uses the class. In it, you may find functionality that would be better located in the data class itself. If this is the case, use Move Method and Extract Method to migrate this functionality to the data class.
- After the class has been filled with well thought-out methods, you may want to get rid of old methods for data access that give overly broad access to the class data. For this, Remove Setting Method and Hide Method may be helpful.

## Payoff

- Improves understanding and organization of code. Operations on particular data are now gathered in a single place, instead of haphazardly throughout the code.
- Helps you to spot duplication of client code.

## Performance Notes

No specific performance guidance captured.

## Related Refactorings

- `Encapsulate Field` (`encapsulate-field`)
- `Encapsulate Collection` (`encapsulate-collection`)
- `Move Method` (`move-method`)
- `Extract Method` (`extract-method`)
- `Remove Setting Method` (`remove-setting-method`)
- `Hide Method` (`hide-method`)

## Related Smells

- None curated yet.
