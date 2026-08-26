---
name: grow
description: Structures current-to-future planning as Goal, Reality, Options, Will so a plan moves from where things are to a chosen outcome. Use when framing a plan, strategy, or coaching that must bridge a current state to a target.
user-invocable: true
disable-model-invocation: false
---

# GROW (Goal, Reality, Options, Will)

## Core Contract

Frame movement from a current state to a target as Goal, Reality, Options, Will.
A drafting and thinking order, not a visible template: the plan must read as prose, never labelled boxes. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Structure

1. **Goal** — the outcome to achieve, stated as an observable end state.
2. **Reality** — the current situation: what exists, what constrains, what has been tried.
3. **Options** — the candidate paths from Reality to Goal, with their trade-offs.
4. **Will** — the chosen path and the commitment to it: what happens next and by whom.

## When to Use

- Plans, strategy notes, product framing, and mentorship or coaching guidance.
- Any change described as a move from a current state to a desired one.
- Pairs with `bluf` (lead with the Goal) and `prep` (justify the chosen Option in Will).

## Guardrails

- Never label the parts (`Goal:` / `Reality:`) in shipped prose; use headings or narrative that carry the same order.
- Never skip Reality; a plan that ignores the current state and constraints is aspiration, not a plan.
- Present real Options with trade-offs before naming the choice; do not retrofit a single predetermined path.
- End on Will: a plan without a committed next step and owner is incomplete.

## Output Style

Target outcome, honest current state, real options with trade-offs, then the committed path and owner.
