---
name: make-loop
description: Creates new repo-native loop runbooks from plan to scaffolded `loops/<name>/LOOP.md` and catalog entry. Use when adding an agent-driven loop to this repository.
user-invocable: true
disable-model-invocation: true
---

# Make Loop

## Core Contract

Create one new loop in this repository as `loops/<name>/LOOP.md`, plus a
`README.md` catalog entry.

A **loop** is an agent-driven runbook: a trigger starts it, an agent iterates
(observe → decide → act → verify) over orchestrated agents and skills, and it
stops on a verifiable goal or a hard brake. A loop is not a skill and not an
agent; it composes them.

Start with a brief plan and explicit assumptions.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## LOOP.md Contract

`LOOP.md` must include required frontmatter keys:

```yaml
name: loop-name
description: One terse sentence describing the loop's outcome. Second sentence describing the trigger/condition that should invoke it.
user-invocable: true
disable-model-invocation: false
```

- `name`: lowercase-hyphenated and must match the loop directory name.
- `description`: third person, outcome-first, ends with `Use when ...`.
- `user-invocable`: default `true` unless explicitly constrained.
- `disable-model-invocation`: default `false` unless explicitly constrained.

Body sections use this default order; omit one only when it does not apply:

1. `# Title`
2. `## Purpose` — what the loop automates and the outcome it drives toward.
3. `## Trigger` — what starts the loop (manual command, CI failure, schedule,
   webhook, file event).
4. `## Goal & Termination` — the verifiable success condition and every explicit
   stop condition. A loop without a verifiable goal is not a loop.
5. `## Agents` — agent profiles the loop orchestrates and each one's role
   (e.g. a `worker` acts, a `reviewer` judges).
6. `## Skills` — skills invoked per step.
7. `## Loop` — numbered iteration: observe → decide → act → verify → repeat.
8. `## Brakes & Budget` — max iterations, no-progress detection, and a token or
   dollar budget. Every loop needs hard brakes.
9. `## Escalation` — when and how to hand back to a human.
10. `## Verification` — how "done" is proven (tests, reviewer agent,
    diff-vs-spec); a claim is not done until something checks it.

Reference an existing loop under `loops/` for the house style.

## Required Inputs

1. Loop purpose and the outcome it drives toward.
2. Trigger and the verifiable goal / termination condition.
3. Proposed name (if any).
4. Agents and skills the loop orchestrates.
5. Brakes (max iterations, no-progress, budget) and escalation path.

## Workflow

1. Restate request and produce a compact creation plan.
2. List assumptions (`safe default` vs `needs confirmation`).
3. Ask only high-impact clarifying questions — especially the verifiable goal,
   the brakes, and which agents/skills the loop composes.
4. Confirm the goal is verifiable and the brakes are concrete before scaffolding;
   a fuzzy goal or missing brake is a stop-and-ask.
5. Normalize/derive the name and validate with `check-skill-name`.
6. Create `loops/<name>/LOOP.md` with required conventions.
7. Add a concise `README.md` catalog row under the Loops section.
8. Verify naming alignment (`name` == directory) and section/policy compliance.
9. Note that `install.sh` links loops into agent-capable harnesses (pi, claude);
   re-run it to install.

Stop and ask if the request spans multiple loops, the name is not `CLEAR`, the
goal is not verifiable, brakes are undefined, or a referenced agent/skill does
not exist.

## Safety Rules

- Never scaffold files before the loop name is `CLEAR` via `check-skill-name`.
- Never scaffold a loop whose goal is not verifiable or whose brakes are
  undefined; an unbounded loop is a token furnace, not a tool.
- Never reference agents or skills that do not exist in this repository.
- Never hide assumptions; label them and confirm high-impact ones.
- Never conflate types: a loop is a `LOOP.md` under `loops/`, never a skill or
  an agent.
- Never leave `README.md` out of sync after adding, renaming, or removing a loop.

## Output Style

Report final loop name and name-check verdict, files changed, the verifiable
goal and brakes, agents/skills composed, assumptions confirmed, defaults
applied, and the reminder to re-run `install.sh`.
