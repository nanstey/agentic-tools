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
5. Output path (auto-detected per the location rules below when not given).

If intent is too vague to design against, stop and ask.

## Workflow

1. Restate the request and the desired change in behaviour.
2. Discover: gather missing context from the user; investigate the codebase to learn current behaviour, boundaries, and affected areas.
3. Reason through consequences: for each desired behaviour change, name what it breaks, touches, or requires downstream.
4. Track every uncertainty as an open question. Resolve each one before designing:
   - Verifiable from the codebase or docs: investigate directly and record the finding.
   - Not verifiable (intent, priorities, external systems): surface to the user via harness question tooling when available, plain questions otherwise.
   - Loop: keep investigating and asking until no open questions remain.
5. Decompose into vertical slices, each independently shippable and verifiable.
6. Resolve the plan's location per the rules below.
7. Write the plan document per the contract below.
8. Report the plan path and how each open question was resolved (verified or answered).

Stop and ask whenever an uncertainty is not verifiable by investigation; do not design past it.

## Plan Location

Decide where the plan file lives by investigating the codebase, not by guessing.

1. Look for a documented or conventional spot: plan/design directories (`docs/plans/`, `plans/`, `.plans/`, `rfcs/`, `design/`, `specs`, `docs/specs`, etc), references in `CLAUDE.md` / `AGENTS.md` / `README`, or where existing plans already sit.
2. If one clear spot exists, assert it and state why.
3. If evidence shows both a persistent spot (tracked, e.g. `docs/plans/`) and an ephemeral one (gitignored or temp, e.g. `/tmp`, a scratch dir), propose both filepaths. Default to the persistent spot unless told otherwise, but surface the choice anyway.
4. If none exists, propose a sensible default and confirm before writing.

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
- Never state an assumption as fact; verify it by investigation or ask the user.
- Never finalize the plan while open questions remain; resolve them all first.
- Never design past an uncertainty that investigation cannot settle without asking first.
- Never pad the plan; cut anything that does not help a reader act.

## Output Style

Report the written plan path, a one-line summary of the change, the phase list, and how each open question was resolved (verified by investigation or answered by the user). The shipped plan carries no open questions.
