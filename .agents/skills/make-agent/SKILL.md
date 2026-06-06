---
name: make-agent
description: Creates new repo-native agent profiles from plan to scaffolded `agents/<name>.md` and catalog alignment. Use when adding an agent profile to this repository.
user-invocable: true
disable-model-invocation: true
---

# Make Agent

## Core Contract

Create one new agent profile in this repository as a single markdown file under `agents/`.
Start with a brief plan and explicit assumptions.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Agent Profile Contract

An agent profile is one `.md` file whose body is the subagent system prompt.

Location contract:

- Preferred path: `agents/<name>.md`.
- Optional grouping directories are cosmetic (`agents/<group>/<name>.md`).
- Frontmatter `name:` is the identity and must stay repo-unique.

Required frontmatter:

```yaml
name: agent-name
description: Third-person summary ending with "Delegate when ..."
tools: Read, Grep, Glob, Bash
model: inherit
```

- `name`: required; lowercase-hyphenated; repo-unique; should match filename.
- `description`: required; third person; ends with `Delegate when ...`.
- `tools`: optional; keep least-privilege; omit to inherit all.
- `model`: optional; `inherit | sonnet | haiku | opus`.

Body contract:

- Imperative, single-role, and self-contained instructions.
- Include stop-and-ask guidance when ambiguity affects behavior or safety.
- Include the override rule: target repo `CLAUDE.md`/`AGENTS.md` wins on conflict.

## Required Inputs

1. Agent purpose and boundaries.
2. Proposed name (if any).
3. Tooling constraints / least-privilege requirements.
4. Model preference (if any).
5. Expected outputs or reporting style.

## Workflow

1. Restate request and produce a compact creation plan.
2. List assumptions (`safe default` vs `needs confirmation`).
3. Ask only high-impact clarifying questions.
4. Normalize/derive agent name and validate repo uniqueness.
5. Create `agents/<name>.md` with compliant frontmatter and prompt body.
6. Ensure prompt includes stop-and-ask gates and override rule.
7. Verify naming alignment (`name`, filename, and references).

Stop and ask if request spans multiple agents, name conflicts with existing tools/agents, or ambiguity changes behavior/safety.

## Safety Rules

- Never scaffold an agent before name uniqueness is confirmed in this repo.
- Never grant more tools than required for the agent's role.
- Never hide assumptions; label and confirm high-impact ones.
- Never skip clarifications when ambiguity affects behavior, safety, or permissions.
- Never silently broaden scope beyond one requested agent without user approval.

## Output Style

Report final agent name/path, assumptions confirmed, defaults applied, and any optional follow-up improvements.
