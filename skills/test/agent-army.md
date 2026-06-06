---
name: agent-army
description: Spin up a TEAM of Claude Code agents that work in parallel, so independent work happens all at once. When the user says "team agents" (or "the army", "use agent teams", "parallelize this"), use Claude Code's team agents feature. Triggers - "team agents", "use team agents", "the army", "spin up agents", "parallelize this".
---

# The Army

One agent does one thing at a time. A TEAM does many at once. This uses Claude
Code's **team agents** feature so independent jobs run in parallel and you can
toggle between teammates to watch each one work.

## When the user says "team agents"

Treat "team agents" (or "use team agents", "the army") as an explicit
instruction to USE THE TEAM AGENTS FEATURE — do not just answer in a single
thread. Spin up a team of teammate agents.

## Steps

1. Split the task into INDEPENDENT chunks — no chunk needs another's output. If
   they're not independent, say so and sequence instead of parallelizing.
2. Create a team and spawn one teammate agent per chunk (Claude Code's team
   agents feature), each with a crisp, self-contained brief.
3. Run them in parallel. Name each teammate by its job so the user can toggle
   between them and watch progress live.
4. Collect the results, resolve conflicts, and synthesize one output.

Rule of thumb: parallelize discovery and independent builds; keep anything
order-dependent inside a single agent.
