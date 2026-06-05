# Duplicate Observed Data

## Metadata

- `id`: `duplicate-observed-data`
- `category`: `Organizing Data` (`organizing-data`)
- `source`: https://refactoring.guru/duplicate-observed-data

## Problem

Is domain data stored in classes responsible for the GUI?

## Solution

Then it’s a good idea to separate the data into separate classes, ensuring connection and synchronization between the domain class and the GUI.

## When To Apply

Is domain data stored in classes responsible for the GUI? You want to have multiple interface views for the same data (for example, you have both a desktop app and a mobile app).

## Why Refactor

You want to have multiple interface views for the same data (for example, you have both a desktop app and a mobile app).

## How To Apply

- Hide direct access to domain data in the GUI class . For this, it’s best to use Self Encapsulate Field . So you create the getters and setters for this data.
- In handlers for GUI class events, use setters to set new field values. This will let you pass these values to the associated domain object .
- Create a domain class and copy necessary fields from the GUI class to it. Create getters and seters for all these fields.
- Create an Observer pattern for these two classes: In the domain class , create an array for storing observer objects ( GUI objects ), as well as methods for registering, deleting and notifying them.
- In the GUI class , create a field for storing references to the domain class as well as the update() method, which will be reacting to changes in the object and update the values of fields in the GUI class . Note that value updates should be established directly in the method, in order to avoid recursion.
- In the GUI class constructor, create an instance of domain class and save it in the field you have created. Register the GUI object as an observer in the domain object .
- In the setters for domain class fields, call the method for notifying the observer (in other words, method for updating in the GUI class ), in order to pass the new values to the GUI.
- Change the setters of the GUI class fields so that they set new values in the domain object directly. Watch out to make sure that values aren’t set through a domain class setter—otherwise infinite recursion will result.

## Benefits

- You split responsibility between business logic classes and presentation classes (cf. the Single Responsibility Principle ), which makes your program more readable and understandable.
- If you need to add a new interface view, create new presentation classes; you don’t need to touch the code of the business logic (cf. the Open/Closed Principle ).
- Now different people can work on the business logic and the user interfaces.

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

- None.

### Helps Refactoring

- None.

### Eliminates Smell

- None.
