---
name: make-agent
description: Creates Pi delegation agent types from plan to scaffolded `agents/<name>.md` and catalog alignment. Use when adding a Pi agent type to this repository.
user-invocable: true
disable-model-invocation: true
---

# Make Agent

## Core Contract

Create one new Pi delegation agent type in this repository as a single markdown file under `agents/`.
Start with a brief plan and explicit assumptions.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Pi agent-type contract

A Pi agent type is one `.md` file whose body is the agent system prompt. The installed subagent extension discovers
these files from `~/.pi/agent/agents`, `.agents/agents`, and `.pi/agents`; this repository
installs managed Pi delegation profiles only into Pi's global directory as regular copied files.

Location contract:

- Preferred path: `agents/<name>.md`.
- Optional grouping directories are cosmetic (`agents/<group>/<name>.md`).
- Frontmatter `name:` is the identity and must stay repo-unique.

Required frontmatter:

```yaml
name: agent-name
description: Third-person summary ending with "Delegate when ..."
tools: [read, grep, find, ls, bash, ext:builtin:codemode/codemode]
extensions: true
skills: true
allowed_subagents: none
```

- `name`: required; lowercase-hyphenated; repo-unique; should match filename.
- `description`: required; third person; ends with `Delegate when ...`.
- `tools` or `disallowed_tools`: optional and mutually exclusive. Use an allowlist for least privilege; read-only types must omit `edit` and `write`. Extension tools must use `ext:<canonical-extension>/<tool>` selectors. `builtin:codemode` is the built-in extension name. Installed package extensions use the canonical installed extension ID, for example `ext:dist/web_search` for pi-web-access.
- `extensions`: `true`, `false`, or a named allowlist. It controls loading. `tools` controls what reaches the model, so any `ext:` selector makes extension tools an explicit allowlist.
- `exclude_extensions`: optional blacklist. Managed delegation profiles with `extensions: true` must exclude `pi-jev` and `pi-fallback-models`, so their per-call exact thinking and provider scope remain intact. Omit it when `extensions: false`.
- `skills`: `true`, `false`, or a named allowlist.
- `model` and `thinking`: omit these from managed `delegation-*` profiles. The coordinator supplies exact provider-qualified model and supported thinking per `Agent` call. Other local agent types may pin them only when their policy explicitly requires it.
- `output_transcript: true` writes a JSONL `.output` transcript under `<tmpdir>/pi-subagents-<uid>/<encoded-cwd>/<session-id>/tasks/<agent-id>.output`.
- `inherit_context` and `prompt_mode` control conversation and parent-system-prompt inheritance.

Body contract:

- Imperative, single-role, and self-contained instructions.
- Include the override rule: target repo `CLAUDE.md`/`AGENTS.md` wins on conflict.
- Delegation profiles must set `allowed_subagents: none` and return their final result directly to the parent; do not require a completion tool, environment variables, or session-log path.

## Required Inputs

1. Agent purpose and boundaries.
2. Proposed name (if any).
3. Tooling constraints / least-privilege requirements.
4. Approved routing-table row for managed `delegation-*` profiles, or fixed model/thinking only for a non-managed local type.
5. Expected outputs or reporting style.

## Workflow

1. Restate request and produce a compact creation plan.
2. List assumptions (`safe default` vs `needs confirmation`).
3. Ask only high-impact clarifying questions.
4. Normalize/derive agent name and validate repo uniqueness.
5. Create `agents/<name>.md` with compliant Pi frontmatter and prompt body.
6. Ensure prompt includes the override rule.
7. Add a concise `README.md` catalog entry under the Agents section.
8. Verify naming alignment (`name`, filename, and references) and catalog sync.

Split multi-agent requests and choose a non-conflicting name.

## Safety Rules

- Never scaffold an agent before name uniqueness is confirmed in this repo.
- Never grant more tools or extensions than required for the agent's role.
- Never hide assumptions; label and confirm high-impact ones.
- Never skip clarifications when ambiguity affects behavior, safety, or permissions.
- Never silently broaden scope beyond one requested agent without user approval.
- Never leave `README.md` out of sync after adding, renaming, or removing an agent.

## Output Style

Report final agent type name/path, extension selectors, routing policy or fixed model/thinking where applicable, assumptions confirmed, defaults applied, and any optional follow-up improvements.
