# AGENTS.md

Guidance for AI agents working **on** this repository.

## What this repo is

This repo stores reusable **agentic tools** and portable harness configuration:

- **Skills**: one `SKILL.md` per directory under `skills/` (portable).
- **Agent profiles**: Claude Code subagents under `agents/`.
- **Harness configuration**: portable files under `harness/<harness>/`.

Skills and agent profiles are installed by **symlink**. Harness configuration is
copied into each harness's runtime directory. `README.md` is the catalog;
`install.sh` performs the installation.

Repo-local authoring helpers live in `.agents/skills/`. `.claude` is a symlink
to `.agents`, so Claude sees the same files at `.claude/skills/`.

Authoring entrypoints:
- `make-skill`: `.agents/skills/make-skill/SKILL.md`
- `make-agent`: `.agents/skills/make-agent/SKILL.md`

Scope by location:

- `skills/`: global artifacts; keep repo/content agnostic.
- `.agents/skills/`: repo-local helpers; follow this `AGENTS.md`.
- `harness/`: portable harness configuration copied into harness-specific runtime
  directories.

## Repository layout

```
.agents/skills/<skill-name>/SKILL.md      # repo-local authoring skill
agents/[<group>/]<agent-name>.md          # agent profiles
skills/<category>/<skill-name>/SKILL.md   # global skill
harness/pi/settings.json                   # portable pi configuration
harness/omp/APPEND_SYSTEM.md               # portable omp system-prompt addition
AGENTS.md                                 # this file
install.sh                                # installer
README.md                                 # catalog
```

Tools are identified by frontmatter `name:`, not path.

- Never place `SKILL.md` at `skills/` root.
- Keep type separation: skills under `skills/` or `.agents/skills/`; agents under `agents/`.

## Authoring conventions

Use the matching authoring skill instead of copying conventions from here:
- `make-skill` defines `SKILL.md` frontmatter/body rules.
- `make-agent` defines agent-profile frontmatter/body rules.

## Adding a new tool

- **Global skill:** add `skills/<category>/<name>/SKILL.md`; mirror
  `skills/dev/pr/SKILL.md`.
- **Repo-local authoring skill:** add `.agents/skills/<name>/SKILL.md`; mirror
  `.agents/skills/make-skill/SKILL.md` or `.agents/skills/make-agent/SKILL.md`.
- **Agent:** add `agents/<name>.md`; mirror `agents/code-reviewer.md` and use
  `.agents/skills/make-agent/SKILL.md`.

For supported types, installer changes are not needed. Re-run `install.sh` to
link. When renaming a tool, rename both path and `name:`, then re-run install
and remove stale links.

## Catalog (README) policy

`README.md` is the catalog and must stay in sync with the tools on disk. Any
change that **adds**, **renames**, or **removes** a skill or agent must update
`README.md` in the same change:

- **Add**: insert a catalog row under the correct section, linking the tool's
  path and using its frontmatter `description`.
- **Rename**: update the row's name, link path, and description together.
- **Remove**: delete the corresponding row.

Keep section placement aligned with the tool's location/category, and keep the
row `description` consistent with the tool's frontmatter. A change to a skill or
agent is not complete until the catalog reflects it.

Any addition, removal, or rename of a managed artifact under `harness/` must
update the corresponding portable harness config table in `README.md`, including
its repository path, install destination, and purpose.

## Commit granularity policy

Default: one skill per commit (`skills/.../<name>/SKILL.md` or
`.agents/skills/<name>/SKILL.md`).

Bundle multiple skills only when lock-step coupled (direct references, shared
contract/schema change, or required atomic shipping). Explain why in the commit
message/body.

## Pi changes must live in the repo

Never fix or tune Pi only in the local installation (`~/.pi/agent/`, including
`npm/node_modules/`). A local-only edit is lost on reinstall and absent on other
machines. Commit every Pi change here and let `install.sh` apply it:

- **Config or extension files:** add under `harness/pi/`.
- **Patches to installed third-party packages:** add a unified diff under
  `harness/pi/patches/` plus an idempotent `install.sh` step (mirror
  `install_jev_prompt_guard_patch`). Use a new patch file rather than editing one
  machines may already have applied.
- Verify by restoring the pristine package files, running `install.sh` twice
  (`patched`, then `ok`), and update the `README.md` harness table.

## Things to avoid

- Putting `SKILL.md` at `skills/` root.
- Mixing artifact types (agents in skill dirs or skills in `agents/`).
- Letting `name:` drift from file/directory name.
- Copying tools into harness dirs (installer symlinks instead).
- Editing the local Pi install (`~/.pi/agent/`) without committing the change here.
- Committing harness secrets, machine-local state, or absolute paths.
- Creating new top-level docs unless requested.
