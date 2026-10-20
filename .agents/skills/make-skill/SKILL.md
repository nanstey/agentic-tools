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

## Name Gate

Before creating any file, run `check-skill-name` on the final name and record its verdict.
Only `CLEAR` permits scaffolding. `CONFLICT` and `RISKY` both block, and a user-requested name does not override this.
On a block, show the verdict, matched name, and 3-5 `CLEAR` alternatives, then stop until the user picks a new name. Re-run the check on the new name.
No risk-acceptance override exists: `RISKY` names collide with harness commands or near-match them.
A skipped or unavailable check is a block, not a pass.

## SKILL.md Contract

`SKILL.md` must include required frontmatter keys:

```yaml
name: skill-name
description: One terse sentence describing the desired outcome of this skill. Second sentence describing conditions that should invoke this skill.
user-invocable: true
disable-model-invocation: false
```

- `name`: lowercase-hyphenated and must match the skill directory name.
- `description`: third person, outcome-first, ends with `Use when ...`.
- `user-invocable`: default `true` unless explicitly constrained.
- `disable-model-invocation`: default `false` unless explicitly constrained.
- `argument-hint` (optional): autocomplete hint for skills that take arguments, e.g. `"[--auto-merge]"` or `"[issue-number]"`. Claude Code-only; other harnesses ignore it. Omit when the skill takes no arguments.

Body sections should use this default order when relevant:

1. `# Title`
2. `## Core Contract` (include scope/tools; target repo `CLAUDE.md` or `AGENTS.md` overrides on conflict)
3. `## Required Inputs`
4. `## Workflow` (numbered)
5. `## <Platform> Implementation Notes` (concrete commands)
6. `## Safety Rules` (`Never ...` constraints)
7. `## Output Style`

Omit irrelevant sections rather than adding filler.

For a planning-only skill that writes an artifact rather than changing the target codebase, include an active planning-only guardrail in that skill itself: implementation imperatives define planning scope rather than execution authority; source edits and follow-on invocation are forbidden; and the skill stops for explicit user review after its artifact. Do not rely on a separate referenced skill for this boundary.

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
4. Run the Name Gate. Stop on any verdict except `CLEAR`.
5. Create `SKILL.md` in confirmed location with required conventions.
6. Add concise `README.md` catalog entry.
7. Verify naming alignment and section/policy compliance.

Split multi-skill requests; each skill passes the Name Gate.

## Safety Rules

- Never create any file before `check-skill-name` returns `CLEAR` for the final name.
- Never report done without a `CLEAR` verdict from an executed check.
- Never hide assumptions; always label them and confirm high-impact ones.
- Never ask location-clarification by default; assume global unless the user directly requests repo-local.
- Never skip clarifying questions when ambiguity affects behavior, tooling, or safety (excluding default location).
- Never violate required repository conventions for frontmatter and section ordering.
- Never silently broaden scope beyond one requested skill without user approval.
- Never leave `README.md` out of sync after adding, renaming, or removing a skill.

## Output Style

Report final category/name and the actual `check-skill-name` verdict (must be `CLEAR`), files changed, assumptions confirmed, defaults applied, and optional next improvements.
