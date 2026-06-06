---
name: skillception
description: Interview the user about a repeatable process and generate a brand-new, installable Claude Code skill for it. The skill that builds skills. Use whenever the user does something more than once. Triggers - "make this a skill", "turn this into a skill", "skillception".
---

# Skillception

If you do it twice, it should be a skill. This interviews you about a process
and writes a complete SKILL.md you can install and reuse forever.

## Steps

1. Ask what process the user wants to capture, then walk through how they do it
   today, step by step. Probe for: the trigger, the inputs, the steps, the
   output, and the gotchas / edge cases.
2. Draft a SKILL.md:
   - frontmatter `name` (kebab-case) + `description` (what it does + when to use
     + trigger phrases)
   - a clear, second-person step-by-step body ("Do X, then Y")
3. Show it to the user, refine, then write it to
   `~/.claude/skills/<name>/SKILL.md`.
4. Tell them how to invoke it.

Keep skills small and single-purpose — one skill, one job. A skill that tries
to do everything gets invoked for nothing.
