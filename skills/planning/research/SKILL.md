---
name: research
description: Investigates a question against high-trust primary sources and captures the findings as a cited Markdown file in the repo. Use when a topic needs researching, docs or API facts gathered, or reading legwork delegated to a background agent.
user-invocable: true
disable-model-invocation: false
---

# Research

## Core Contract

Answer a question from **primary sources** and leave the findings behind as one cited Markdown file in the repo.
Spin up a **background agent** to do the reading, so the main session keeps working while it investigates.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Workflow

Delegate the research to a background agent with this job:

1. Investigate the question against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, **citing each claim's source**.
3. Save it where the repo already keeps such notes; match the existing convention. If there is none, put it somewhere sensible and say where.

## Safety Rules

- Never cite a secondary write-up when the primary source is reachable.
- Never state a claim without linking the source that owns it.
- Never block the main session waiting on the read; run it in the background.
- Never invent a notes location silently; follow the repo convention or state the chosen path.

## Output Style

Report the question researched, the saved file path, and a one-line gist of the finding.
