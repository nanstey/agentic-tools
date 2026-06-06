---
name: make-skill
description: Creates new repo-native skills from plan to scaffolded `SKILL.md` and catalog entry. Use when adding a skill to this repository.
user-invocable: true
disable-model-invocation: true
---

# Make Skill

## Core Contract

Create one new skill in this repository, including compliant `SKILL.md` and `README.md` catalog entry.
Default location is `skills/<category>/<name>/SKILL.md`; use `.agents/skills/` only when explicitly requested.
Start with a brief plan and explicit assumptions.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Skill purpose/workflow.
2. Target category.
3. Proposed name (if any).
4. Required tools, constraints, and safety rules.
5. Output/reporting expectations.

## Workflow

1. Restate request and produce a compact creation plan.
2. List assumptions (`safe default` vs `needs confirmation`).
3. Ask only high-impact clarifying questions.
4. Normalize/derive name and validate with `check-skill-name`.
5. Create `SKILL.md` in confirmed location with required conventions.
6. Add concise `README.md` catalog entry.
7. Verify naming alignment and section/policy compliance.

Stop and ask if request spans multiple skills, name is not `CLEAR`, or ambiguity changes behavior/safety.

## Safety Rules

- Never scaffold files before the skill name is `CLEAR` via `check-skill-name`.
- Never hide assumptions; always label them and confirm high-impact ones.
- Never ask location-clarification by default; assume global unless the user directly requests repo-local.
- Never skip clarifying questions when ambiguity affects behavior, tooling, or safety (excluding default location).
- Never violate required repository conventions for frontmatter and section ordering.
- Never silently broaden scope beyond one requested skill without user approval.

## Output Style

Report final category/name and name-check verdict, files changed, assumptions confirmed, defaults applied, and optional next improvements.
