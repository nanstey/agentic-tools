---
name: make-agent
description: Creates Lite agent types from plan to scaffolded `agents/<name>.md` and catalog alignment. Use when adding a Pi agent type to this repository.
user-invocable: true
disable-model-invocation: true
---

# Make Agent

## Core Contract

Create one new Pi Lite agent type in this repository as a single markdown file under `agents/`.
Start with a brief plan and explicit assumptions.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Lite Agent-Type Contract

A Lite agent type is one `.md` file whose body is the agent system prompt. Lite discovers
these files from `~/.pi/agent/agents`, `.agents/agents`, and `.pi/agents`; this repository
installs them into the global directory by symlink.

Location contract:

- Preferred path: `agents/<name>.md`.
- Optional grouping directories are cosmetic (`agents/<group>/<name>.md`).
- Frontmatter `name:` is the identity and must stay repo-unique.

Required frontmatter:

```yaml
name: agent-name
description: Third-person summary ending with "Delegate when ..."
tools: [read, grep, find, ls, bash]
extensions: true
skills: true
model: provider/model-id
thinking: medium
```

- `name`: required; lowercase-hyphenated; repo-unique; should match filename.
- `description`: required; third person; ends with `Delegate when ...`.
- `tools` or `exclude_tools`: optional and mutually exclusive. Use an allowlist for least privilege; read-only types must omit `edit` and `write`.
- `extensions`: `true`, `false`, or a named allowlist. Set `true` when the type needs normal Pi extensions such as auth, fallback, web access, or codemode.
- `skills`: `true`, `false`, or a named allowlist.
- `model`: fixed `provider/model-id` when the routing policy assigns this type a model.
- `thinking`: fixed supported level (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, or `parent`). Tool dispatch cannot override it.
- `output_transcript: true` writes a human-readable transcript to `/tmp/pi-agent-outputs/<agentId>.log`.
- `include_context_files` and `include_system_prompt` control AGENTS.md and parent-prompt inheritance.

Body contract:

- Imperative, single-role, and self-contained instructions.
- Include the override rule: target repo `CLAUDE.md`/`AGENTS.md` wins on conflict.
- Lite agents cannot spawn agents and return their final result directly to the parent; do not require a completion tool, environment variables, or session-log path.

## Required Inputs

1. Agent purpose and boundaries.
2. Proposed name (if any).
3. Tooling constraints / least-privilege requirements.
4. Fixed model and thinking tier, or the approved routing-table row.
5. Expected outputs or reporting style.

## Workflow

1. Restate request and produce a compact creation plan.
2. List assumptions (`safe default` vs `needs confirmation`).
3. Ask only high-impact clarifying questions.
4. Normalize/derive agent name and validate repo uniqueness.
5. Create `agents/<name>.md` with compliant Lite frontmatter and prompt body.
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

Report final agent type name/path, model/thinking, assumptions confirmed, defaults applied, and any optional follow-up improvements.
