# Extract Subclass

## Metadata

- `id`: `extract-subclass`
- `category`: `Dealing with Generalization` (`dealing-with-generalization`)
- `source`: https://refactoring.guru/extract-subclass

## Problem

A class has features that are used only in certain cases.

## Solution

Create a subclass and use it in these cases.

## When To Apply

A class has features that are used only in certain cases. Your main class has methods and fields for implementing a certain rare use case for the class.

## Why Refactor

Your main class has methods and fields for implementing a certain rare use case for the class.

## How To Apply

- Create a new subclass from the class of interest.
- If you need additional data to create objects from a subclass, create a constructor and add the necessary parameters to it. Don’t forget to call the constructor’s parent implementation.
- Find all calls to the constructor of the parent class. When the functionality of a subclass is necessary, replace the parent constructor with the subclass constructor.
- Move the necessary methods and fields from the parent class to the subclass. Do this via Push Down Method and Push Down Field . It’s simpler to start by moving the methods first. This way, the fields remain accessible throughout the whole process: from the parent class prior to the move, and from the subclass itself after the move is complete.
- After the subclass is ready, find all the old fields that controlled the choice of functionality. Delete these fields by using polymorphism to replace all the operators in which the fields had been used. A simple example: in the Car class, you had the field isElectricCar and, depending on it, in the refuel() method the car is either fueled up with gas or charged with electricity. Post-refactoring, the isElectricCar field is removed and the Car and ElectricCar classes will have their own implementations of the refuel() method.

## Benefits

- Creates a subclass quickly and easily.
- You can create several separate subclasses if your main class is currently implementing more than one such special case.

## Tradeoffs

- Validate scope and behavior preservation before broad changes.
- Prefer incremental commits for risky transformations.

## Validation Checks

- Existing tests pass (or equivalent behavioral verification).
- Readability/complexity is improved in touched scope.
- Follow-on refactors are explicitly called out, not implied.

## Relationships

### Anti Refactoring

- None.

### Similar Refactoring

- `Extract Class` (`extract-class`) -> `techniques/moving-features-between-objects/extract-class.md`

### Helps Refactoring

- None.

### Eliminates Smell

- None.
