# Architecture Note Template

For explaining how parts of a system fit together and why. Describes structure and relationships in the present tense.

````markdown
# <System or Area> Architecture

<One or two sentences: scope of this note and what it covers.>

## Overview

<What the system does, at a high level. The problem it addresses.>

## Components

<Each major part and its responsibility.>

| Component | Responsibility |
| --- | --- |
| `<name>` | <what it owns> |

## Data Flow

<How a request or data moves through the components. Diagram when it clarifies.>

```
<client> -> <service> -> <store>
```

## Key Relationships

<How components depend on or communicate with each other. Contracts between them.>

## Constraints

<Boundaries the design holds to: consistency, performance, security, compatibility.>
````

## Notes

- Describe the current structure, not the history that produced it.
- Keep no ticket numbers, migration stories, or "we decided" narration.
- Use a diagram only where it beats prose; label every node.
- Name real components (services, modules, tables); avoid generic placeholders in the final doc.
