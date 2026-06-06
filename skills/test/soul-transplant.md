---
name: soul-transplant
description: Interview the user documentary-style and compile a SOUL.md that captures who they are and how they think, so their agents reason like them. Use when setting up a new agent or personalizing an existing one. Triggers - "build my soul file", "who am I", "soul transplant", "make it think like me".
---

# The Soul Transplant

A generic agent gives generic answers. This interviews you like a documentary
subject and pours the result into SOUL.md, so the agent inherits your judgment.

## Steps

1. Interview the user, ONE question at a time (wait for each answer before the
   next):
   - Who are you, and what are you actually trying to build?
   - How do you make decisions — gut, data, speed, caution?
   - What do you value, and what will you flat-out refuse to do?
   - How do you communicate — tone, length, formality, pet hates?
   - What context do you always wish people already knew about you?
   - What does a genuinely great outcome look like to you?
   Ask sharp follow-ups when an answer is thin. Depth over breadth.
2. Synthesize the answers into `SOUL.md` with clear sections:
   `## Who I Am` · `## How I Decide` · `## What I Value` ·
   `## How I Communicate` · `## Standing Context` · `## What Good Looks Like`
3. Save `SOUL.md` and reference it from CLAUDE.md so every session loads it.
4. Show the user the file and offer to refine any section.

Write in the user's own voice, using their words. This is their soul, not yours.
