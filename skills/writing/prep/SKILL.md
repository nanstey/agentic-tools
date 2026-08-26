---
name: prep
description: Structures a persuasive case as Point, Reason, Example, Point so a recommendation lands with evidence and reinforcement. Use when arguing for a decision and the reader must be convinced, not merely informed.
user-invocable: true
disable-model-invocation: false
---

# PREP (Point, Reason, Example, Point)

## Core Contract

Make a persuasive case by stating the point, justifying it, grounding it in a concrete instance, then restating it.
A drafting order, not a visible template: the four beats must read as natural argument, never a labelled scaffold. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Structure

1. **Point** — the claim or recommendation, stated up front.
2. **Reason** — why it holds or why it matters.
3. **Example** — concrete evidence: a specific case, measurement, or instance.
4. **Point** — restate the claim to reinforce it, sharpened by the reason and example.

## When to Use

- Recommendations in reviews, proposals, design docs, and decision memos.
- Any argument where the reader needs a reason to agree, not just a description of what changed.
- Pairs with `bluf`: the opening Point is the bottom line; Reason and Example are the supporting context.

## Guardrails

- Never label the parts (`Point:` / `Reason:`) in shipped prose.
- Never pad the closing Point into a summary paragraph; one sharpened restatement, or drop it when the case is already made.
- Ground the Example in something real and specific; a vague example weakens the case more than none.

## Output Style

Claim first, reason and concrete evidence next, a tight restatement to close.
