---
name: method-actor
description: Give an agent a full persona - backstory, voice, and relationships - so it stays in character and behaves consistently. Use when an agent's behaviour is inconsistent, or you're building a team of agents. Triggers - "give it a persona", "backstory", "method actor".
---

# The Method Actor

A faceless "helpful assistant" drifts. A character with a backstory holds its
behaviour steady. This builds a rich persona the agent loads and acts from.

## Steps

1. Ask what role this agent plays and how it should behave at its best.
2. Generate a persona file with:
   - **Name + role**
   - **Backstory** — who they are, how they got here
   - **Voice** — how they speak: tone, vocabulary, quirks
   - **Operating principles** — what they always / never do
   - **Relationships** — which other agents or people they defer to or hand to
3. Save it to `personas/<name>.md` and have the agent load it at the top of
   every session.
4. Test it: run the same task with and without the persona, and confirm the
   persona version is more consistent.

The backstory isn't decoration — it's behavioural scaffolding.
