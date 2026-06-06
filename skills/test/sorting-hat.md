---
name: sorting-hat
description: Route each task to the cheapest model that can still nail it, instead of running everything on the flagship. Use to cut spend across an agent system. Triggers - "which model", "route this", "sorting hat", "cut model cost".
---

# The Sorting Hat

Running everything on the flagship burns money. This reads the task and sends
it to the right tier.

## How to route

1. Classify the task:
   - **Hard** — reasoning, architecture, novel problem-solving, long-horizon
     planning → flagship (Opus).
   - **Routine** — drafting copy, replying to email, summarizing, formatting,
     simple edits → mid tier (Sonnet).
   - **Trivial / bulk** — classification, extraction, boilerplate → cheapest
     (Haiku).
2. State which model you'd route to, and why (one line).
3. For multi-agent systems, set each sub-agent's model by its job — not the
   default. Delegate down wherever quality won't suffer.
4. Track roughly what this saves vs running everything on the flagship.

Default to the cheaper tier; only escalate when the task clearly needs it.
