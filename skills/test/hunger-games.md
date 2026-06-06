---
name: hunger-games
description: Score and rank competing agent or build ideas so you build the highest-value one first. Use when you have several things you could build and need to decide. Triggers - "which should I build", "score these ideas", "decision matrix", "hunger games".
---

# The Hunger Games

Your ideas fight; one survives. This scores every candidate against what
actually matters, so you don't sink weeks into the wrong build.

## Steps

1. Collect the candidate ideas (ask the user to list them, or read them from
   context).
2. For EACH idea, get a 1–5 score on:
   - **Impact** — how much it changes things
   - **Time saved** — per week, ongoing
   - **Money** — earned or saved
   - **Ease of build** — 5 = trivial, 1 = brutal
   Ask one idea at a time. Offer your own estimate first to anchor, then let
   the user adjust.
3. Total each idea. Print a ranked table, highest score first.
4. Declare the winner with a one-line "why this one".
5. Offer to kick the winner straight into `/treasure-map` or `/soul-transplant`.

If the user has a strong priority, weight that column (e.g. money ×2). Re-run
whenever the idea list changes.
