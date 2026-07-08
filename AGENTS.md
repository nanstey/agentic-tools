# AGENTS.md

Guidance for AI agents working **on** this repository.

## What this repo is

This repo stores reusable **agentic tools**:

- **Skills**: one `SKILL.md` per directory under `skills/` (portable).
- **Agent profiles**: Claude Code subagents under `agents/`.
- **Loops**: one `LOOP.md` per directory under `loops/`; agent-driven runbooks
  that orchestrate agents and skills (trigger → iterate → verifiable goal/brake).

Tools are installed by **symlink**. Editing here updates linked harnesses.
`README.md` is the catalog. `INSTALL.md` performs linking.

Repo-local authoring helpers live in `.agents/skills/`. `.claude` is a symlink
to `.agents`, so Claude sees the same files at `.claude/skills/`.

Authoring entrypoints:
- `make-skill`: `.agents/skills/make-skill/SKILL.md`
- `make-agent`: `.agents/skills/make-agent/SKILL.md`
- `make-loop`: `.agents/skills/make-loop/SKILL.md`

Scope by location:

- `skills/`: global artifacts; keep repo/content agnostic.
- `.agents/skills/`: repo-local helpers; follow this `AGENTS.md`.

## Repository layout

```
.agents/skills/<skill-name>/SKILL.md      # repo-local authoring skill
agents/[<group>/]<agent-name>.md          # agent profiles
loops/<loop-name>/LOOP.md                 # loop runbook
skills/<category>/<skill-name>/SKILL.md   # global skill
AGENTS.md                                 # this file
INSTALL.md                                # symlink installer
README.md                                 # catalog
```

Tools are identified by frontmatter `name:`, not path.

- Never place `SKILL.md` at `skills/` root, or `LOOP.md` at `loops/` root.
- Keep type separation: skills under `skills/` or `.agents/skills/`; agents under
  `agents/`; loops under `loops/`.

## Authoring conventions

Use the matching authoring skill instead of copying conventions from here:
- `make-skill` defines `SKILL.md` frontmatter/body rules.
- `make-agent` defines agent-profile frontmatter/body rules.

## Adding a new tool

- **Global skill:** add `skills/<category>/<name>/SKILL.md`; mirror
  `skills/pull-requests/pr-ci/SKILL.md`.
- **Repo-local authoring skill:** add `.agents/skills/<name>/SKILL.md`; mirror
  `.agents/skills/make-skill/SKILL.md` or `.agents/skills/make-agent/SKILL.md`.
- **Agent:** add `agents/<name>.md`; mirror `agents/reviewer.md` and use
  `.agents/skills/make-agent/SKILL.md`.
- **Loop:** add `loops/<name>/LOOP.md`; use `.agents/skills/make-loop/SKILL.md`.
  Loops install only into harnesses that also receive agents (pi, claude).

For supported types, installer changes are not needed. Re-run `install.sh` to
link. When renaming a tool, rename both path and `name:`, then re-run install
and remove stale links.

## Catalog (README) policy

`README.md` is the catalog and must stay in sync with the tools on disk. Any
change that **adds**, **renames**, or **removes** a skill, agent, or loop must
update `README.md` in the same change:

- **Add**: insert a catalog row under the correct section, linking the tool's
  path and using its frontmatter `description`.
- **Rename**: update the row's name, link path, and description together.
- **Remove**: delete the corresponding row.

Keep section placement aligned with the tool's location/category, and keep the
row `description` consistent with the tool's frontmatter. A change to a skill,
agent, or loop is not complete until the catalog reflects it.

## Commit granularity policy

Default: one tool per commit (`skills/.../<name>/SKILL.md`,
`.agents/skills/<name>/SKILL.md`, `agents/<name>.md`, or
`loops/<name>/LOOP.md`).

Bundle multiple tools only when lock-step coupled (direct references, shared
contract/schema change, or required atomic shipping). Explain why in the commit
message/body.

## Things to avoid

- Putting `SKILL.md` at `skills/` root, or `LOOP.md` at `loops/` root.
- Mixing artifact types (agents in skill dirs, skills in `agents/`, or loops
  outside `loops/`).
- Letting `name:` drift from file/directory name.
- Copying tools into harness dirs (installer symlinks instead).
- Committing harness-specific or absolute-path artifacts.
- Creating new top-level docs unless requested.
