---
name: treasure-map
description: Turn a hand-drawn or spoken architecture into a precise file/folder structure and decision-flow spec, so the agent builds exactly what you designed and can't hallucinate. Use before building any multi-file agent. Triggers - "architect this", "map the file structure", "treasure map".
---

# The Treasure Map

You design the structure; the agent just builds it. Walk through your
architecture out loud — ideally from a pen-and-paper sketch — and this captures
every folder, file, and the conditions under which the agent visits each.

## Steps

1. Prompt the user to describe their architecture top-down, as if reading a
   flowchart they drew. For each node, capture:
   - the folder/file
   - WHEN the agent goes there (the trigger / condition)
   - WHAT it finds there and what decision it makes
2. Reflect it back as a tree **and** a table of `trigger → location → what
   happens`. Ask the user to correct anything.
3. Write the agreed design to `ARCHITECTURE.md` and scaffold the empty
   folders/files.
4. Add routing rules to CLAUDE.md: "If the request involves X, read file Y."

Encourage the user to sketch on paper and narrate it — the whole point is that
THEY designed it, so the agent can't invent files that shouldn't exist.
