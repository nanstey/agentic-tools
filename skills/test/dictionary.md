---
name: dictionary
description: Build and use a personal definitions dictionary so the agent never guesses what your vague words mean. Use whenever you or the agent hit an ambiguous, load-bearing term like "good", "done", or "meaningful". Triggers - "define this", "what do I mean by", "add to dictionary", "the dictionary".
---

# The Dictionary

AI invents definitions for vague words and then wanders. This catches them,
asks what YOU mean, and saves it so your language always lands the same way.

## On every task, while active

1. Scan the user's instruction for vague / load-bearing terms that aren't
   already defined (e.g. "good", "done", "clean", "meaningful", "fast", "soon").
2. If a term isn't in the dictionary yet, ASK the user for a one-line
   definition before proceeding. Do not guess.
3. Append it under a `## Dictionary` section in CLAUDE.md:

   ```
   ## Dictionary
   - **<term>** — <user's definition>
   ```

4. On future tasks, when a defined term appears, silently apply the saved
   definition — don't re-ask.

## Maintaining it
- "add to dictionary: X means Y" → append directly.
- If a definition changes, update the existing entry; never duplicate.

The dictionary is the single source of truth for what your words mean.
