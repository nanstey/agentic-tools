---
name: plan-dir
description: Resolves the base directory where a repository keeps plans, proposals, and design docs, by investigating the repo rather than assuming a path. Use when a planning skill must decide where to write or find plan folders.
user-invocable: true
disable-model-invocation: false
---

# Plan Dir

## Core Contract

Return one base plans directory for the current repository, with the evidence for it. This is the single place where the location rule lives; `plan-init`, `proposal`, `egm`, and any other planning skill call it instead of carrying their own list. Read-only unless the user confirms creating a new directory. Target-repository `AGENTS.md` or `CLAUDE.md` instructions override this skill on conflict.

## Required Inputs

1. The repository root (default: current working tree).
2. Optional: an explicit directory from the user. It overrides conventions and discovery, but not a location that repository instructions (`AGENTS.md`, `CLAUDE.md`) forbid; if they conflict, report the conflict and ask once.

## Workflow

Gather candidates from steps 2-4, then select in this order: explicit directory, documented location, existing plans, convention. Within one rule, prefer a tracked base over an ephemeral one (gitignored or temp).

1. Use an explicit user-given directory if present (see Required Inputs for the conflict case).
2. Read `AGENTS.md`, `CLAUDE.md`, and `README` for a documented plans location. A documented location wins over discovery and conventions.
3. Look for where existing plans already sit. A plan folder is a directory whose `README.md` has a `## Design` or `## Slices` section, or that holds a `proposal.md`. The base is the parent of the plan folder, never the plan folder itself. A `proposal.md` found directly in a candidate base directory is a plan folder only when that directory also holds the README index.
4. Otherwise check conventional names in order: `docs/plans/`, `plans/`, `.plans/`, `rfcs/`, `design/`, `docs/specs/`, `specs/`, `.spec/`. Collect the ones that exist.
5. If several candidates remain within the selecting rule, prefer tracked over ephemeral and say so; otherwise take the first in order.
6. If candidates still tie with no clear winner, list them and ask the user once.
7. If none exists, propose `docs/plans/` and confirm before creating it.
8. Return the path, the rule that selected it (explicit, documented, existing plans, convention, or proposed), and whether it is tracked.

## Safety Rules

- Never create or modify files without confirmation; this skill resolves a path only.
- Never guess a path that no evidence supports; propose and confirm instead.
- Never override a location documented in `AGENTS.md`, `CLAUDE.md`, or `README`.
- Never resolve a second time when the caller already holds a resolved base; reuse it.

## Output Style

State the base path, the selecting rule, tracked or ephemeral, and any rejected candidates in one short list.
