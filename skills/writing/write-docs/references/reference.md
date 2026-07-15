# Reference Template

For looking up precise details: APIs, commands, config, schemas. Describes the contract, not the implementation.

```markdown
# <Component / Command / Endpoint name>

<One sentence: what it is and what it does.>

## Signature

<Function signature, command synopsis, or endpoint definition.>

## Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `<name>` | `<type>` | yes/no | `<value>` | <effect> |

## Returns

<Return value or response shape, with types.>

## Errors

| Condition | Result |
| --- | --- |
| <when> | <error, code, or exception> |

## Example

<Minimal call and its output.>
```

## Notes

- Describe behaviour: inputs, outputs, effects, errors. Leave out internal mechanics.
- Keep entries uniform so readers can scan across them.
- State types and defaults exactly; verify against the actual interface.
- Present tense. Document what it does now, not what it used to do.
