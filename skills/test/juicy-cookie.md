---
name: juicy-cookie
description: Install a reinforcement reward/punishment system into an agent so it relentlessly pursues a well-defined goal and flees failure. Use when setting up or tuning an agent that needs to stay on-objective. Triggers - "set up the reward", "define success and failure", "make the agent care about X", "juicy cookie".
---

# The Juicy Cookie

Agents drift because nothing is at stake for them. This installs a reward it
craves and a consequence it dreads, anchored to a hard definition of success
and failure — so every action is scored against the goal.

## Steps

1. Ask the user for the agent's single most important GOAL (one sentence).
2. Pin down SUCCESS — the measurable outcome(s) that mean the goal is hit.
   Push for numbers/thresholds, not vibes (e.g. "reply within 2 min",
   "drawdown < 8%", "0 hallucinated files").
3. Pin down FAILURE — the measurable line(s) that mean it has failed.
4. Write a reward/consequence block into the agent's CLAUDE.md (or SOUL.md):

   ```
   ## The Juicy Cookie (reward system)
   - SUCCESS = <criteria>. Moving toward this earns the juicy cookie — the thing
     you want more than anything. Pursue it relentlessly.
   - FAILURE = <criteria>. Drifting toward this gets you burned. Avoid at all costs.
   - Before every action ask: does this move me toward the cookie, or the burn?
   ```

5. Confirm the block is in place and show it to the user.

Keep the reward and the burn vivid and singular — one cookie, one fire. Re-run
to retune as the goal sharpens.
