---
name: observation-impact-question
description: Structures lightweight feedback as Observation, Impact, Question so on-the-spot input stays specific and non-accusatory. Use when giving casual feedback or review comments without a heavy performance-review frame.
user-invocable: true
disable-model-invocation: false
---

# Observation-Impact-Question (OIQ)

## Core Contract

Give feedback as a neutral observation, its concrete impact, then a question that hands agency back.
A drafting order, not a visible template: it must read as a normal comment, never a labelled form. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Structure

1. **Observation** — what was noticed, stated factually: "I noticed <specific action>."
2. **Impact** — the effect of that action on you, the reader, the code, or the outcome.
3. **Question** — an open question or request that invites response: "What are your thoughts?", "Would you be open to <x>?"

## When to Use

- Review comments, PR threads, and casual on-the-spot feedback.
- Findings that suggest a change without mandating one, where the author keeps the decision.
- Optional openers: lead with a genuine compliment, and ask permission before feedback the reader did not invite.

## Guardrails

- Never label the parts (`Observation:` / `Impact:`) in shipped prose.
- Keep the Observation factual and specific; describe the action, not the person or a motive.
- Make the Question genuine — an open invitation, not a rhetorical demand wearing a question mark.
- Do not stack multiple critiques into one OIQ; one observation per comment.

## Output Style

A factual observation, its concrete impact, and an open question that leaves the decision with the author.
