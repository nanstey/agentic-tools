---
name: plan-init
description: Creates a plan folder with a README index so a change's planning artifacts and per-slice specs live together and stay linked. Use when starting planning that will produce multiple related documents or feed a build.
user-invocable: true
disable-model-invocation: false
---

# Plan Init

## Core Contract

Create one plan folder and its README index for a change. Write the folder and a README scaffold only; do not pre-generate design artifacts or spec files. Each planning skill writes its own file into the folder as needed and registers it in the README index.

This skill defines the canonical **Plan Folder Layout** and **README Index Contract** that the other planning skills and `build` reference. Inspect the target repository read-only aside from creating the folder and README; target-repository `AGENTS.md` or `CLAUDE.md` instructions override this skill on conflict.

## Required Inputs

1. The change or feature the plan folder is for.
2. Base plans directory, or permission to resolve and propose one.
3. A slug for the folder, or permission to derive one.

If intent is too vague to name a folder, stop and ask.

## Plan Folder Layout

```
<base>/<slug>/
  README.md                # index; created here
  product-review.md        # optional; written by product-review
  system-architecture.md   # optional; written by system-architecture
  program-design.md        # optional; written by program-design
  proposal.md              # optional; written by proposal
  vertical-slices.md       # optional; written by vertical-slices
  specs/
    NN-<slice-slug>.md      # written by speclist, one file per slice
```

- Only `README.md` is created up front. Every other file appears when its skill runs.
- `specs/` holds one checklist per slice, numbered `NN-` to match the slice number in the README `## Slices` table. Each spec file is scoped to a single PR; specs are implemented, reviewed, and stacked independently.

## README Index Contract

The README is the single entry point: a reader or `build` agent opens it to see the big picture, find each artifact, and identify the slice in progress. Use fixed, single-owner sections so skills update it without clobbering each other.

```markdown
# <Title>

- Status: planning | building | done
- Summary: <one line>

## Design
| Stage | Doc | Status |
| --- | --- | --- |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |

## Decision log
```

Section ownership:

- **plan-init** writes the title, `Status: planning`, summary, and the empty `## Design`, `## Slices`, and `## Decision log` sections.
- **Design skills** (`product-review`, `system-architecture`, `program-design`, `proposal`) each upsert their own row in `## Design` (`Stage | ./<file>.md | draft|done`).
- **vertical-slices** seeds `## Slices` with one numbered row per slice and upserts its own `## Design` row.
- **speclist** writes `specs/NN-<slice-slug>.md` and fills the `Spec` cell of the matching slice row.
- **build** updates each slice row's `PR` and `Status`, sets top-level `Status`, and appends to `## Decision log` when a design changes during implementation.
- **Decision log** is append-only: `YYYY-MM-DD — what changed and which doc was updated`.

## Workflow

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as "build," "implement," "ship," or "wire up" as folder-setup scope, not permission to execute.
2. Resolve the base plans directory by investigation, not guessing: prefer a documented or conventional spot (`docs/plans/`, `plans/`, `.plans/`, `rfcs/`, `design/`, `specs/`, `docs/specs/`), references in `CLAUDE.md` / `AGENTS.md` / `README`, or where existing plans already sit. If none exists, propose a sensible default and confirm before writing.
3. Derive a short `<slug>` from the change; confirm if not given.
4. If `<base>/<slug>/` already exists, stop and ask before reusing or overwriting it.
5. Create `<base>/<slug>/README.md` from the README Index Contract, filling title, `Status: planning`, and summary; leave the tables empty.
6. Present the folder and README path for explicit user review and stop; do not begin planning artifacts, generate spec files, or invoke a follow-on skill.

## Safety Rules

- Never modify the codebase beyond creating the plan folder and its README.
- Never pre-generate design artifacts or spec files; each is written by its own skill on demand.
- Never overwrite an existing plan folder or README without explicit confirmation.
- Never treat an implementation imperative as permission to edit source or start building.
- Never pad the README; keep the scaffold minimal and the sections fixed.

## Output Style

Report the folder path, README path, the resolved base directory and why, and the slug. Name the design skills and `build` as the next steps, but do not invoke them; wait for explicit user approval.
