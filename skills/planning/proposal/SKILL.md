---
name: proposal
description: Runs discovery and uncertainty resolution for a change, then writes a terse plan document covering purpose, behaviour, validation, architecture, and phased vertical slices. Use before building when a change needs a clear, agreed design.
user-invocable: true
disable-model-invocation: false
---

# Proposal

## Core Contract

Turn a change request into one written plan document that a human, team, or agent can read and act on.
Discover context from the user and the codebase, resolve every uncertainty up front, then design the change.
Make no assumptions in the plan: verify each fact by direct investigation, or ask the user. Repeat until no open questions remain.
Read-only on the codebase; the only output is the plan file.
Write the plan and the chat terse and deslopped: simple but exact language, no filler.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The change request or problem statement.
2. Affected system(s) and entry points.
3. Constraints (tech, deadlines, compatibility) and definition of done.
4. Validation and verification tooling available.
5. Plan folder (via `plan-init`), auto-resolved per the location rules below when not given.

If intent is too vague to design against, stop and ask.

## Workflow

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as “build,” “implement,” “ship,” or “wire up” as planning scope, not permission to execute.
2. Restate the request and the desired change in behaviour.
3. Discover: gather missing context from the user; investigate the codebase to learn current behaviour, boundaries, and affected areas.
4. Reason through consequences: for each desired behaviour change, name what it breaks, touches, or requires downstream.
5. Track every uncertainty as an open question. Resolve each one before designing:
   - Verifiable from the codebase or docs: investigate directly and record the finding.
   - Not verifiable (intent, priorities, external systems): surface to the user via harness question tooling when available, plain questions otherwise.
   - Loop: keep investigating and asking until no open questions remain.
6. Decompose into vertical slices, each independently shippable and verifiable.
7. Resolve the plan folder per the rules below.
8. Write the plan to `<plan-folder>/proposal.md` per the contract below, upsert its row in the README `## Design` table, and seed the README `## Slices` table from the implementation phases (one numbered row per phase; leave `Spec`, `PR`, and `Status` blank).
9. Present the plan for explicit user review and stop; do not begin implementation or invoke a follow-on skill.
10. Report the plan path and how each open question was resolved (verified or answered).

Stop and ask whenever an uncertainty is not verifiable by investigation; do not design past it.

## Plan Location

The plan lives in a plan folder (`plan-init`'s Plan Folder Layout) as `<plan-folder>/proposal.md`, so it stays linked to any later architecture, design, slice, and spec files through the folder's README index. Decide the folder by investigating the codebase, not by guessing.

1. Reuse an existing plan folder for this change if one exists.
2. Otherwise resolve the base plans directory: a documented or conventional spot (`docs/plans/`, `plans/`, `.plans/`, `rfcs/`, `design/`, `specs/`, `docs/specs/`), references in `CLAUDE.md` / `AGENTS.md` / `README`, or where existing plans already sit. If one clear base exists, assert it and state why.
3. If evidence shows both a persistent base (tracked, e.g. `docs/plans/`) and an ephemeral one (gitignored or temp), surface the choice and default to the persistent base unless told otherwise.
4. If no base exists, propose a sensible default and confirm before writing.
5. Create the folder and README via `plan-init` (or its layout) before writing `proposal.md`.

## Plan Document Contract

Include these sections; omit one only when it does not apply.

1. **Purpose** — why the change exists; the problem and intended outcome.
2. **User story & scenarios** — the story and the scenarios it covers.
3. **Behaviour** — Given/When/Then for each scenario, including edge cases.
4. **QA** — how each behaviour is proven (tests, checks, manual steps) and the tooling used.
5. **Architecture** — high-level choices and the rejected alternative when it was the assumed default.
6. **Affected areas** — new and existing components, files, and interfaces touched.
7. **Schema migrations** — data/schema changes and migration path; omit if none.
8. **Implementation phases** — ordered vertical slices; each names its deliverable and a concrete V&V gate that must pass before the next.

Code snippets only when they convey the change more succinctly than prose. Diagrams welcome where they clarify structure or flow.

## Safety Rules

- Never modify the codebase; this skill investigates and plans only.
- Never treat an implementation imperative as permission to edit source, invoke a build workflow, or proceed past the review gate.
- Explicit approval of the plan selects a later, separate planning or build phase; it never authorizes source edits within this skill.
- Never state an assumption as fact; verify it by investigation or ask the user.
- Never finalize the plan while open questions remain; resolve them all first.
- Never design past an uncertainty that investigation cannot settle without asking first.
- Never pad the plan; cut anything that does not help a reader act.

## Output Style

Report the written plan path, a one-line summary of the change, the phase list, how each open question was resolved (verified by investigation or answered by the user), and review status. The shipped plan carries no open questions. Wait for explicit user approval before any follow-on work.
