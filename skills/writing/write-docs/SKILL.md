---
name: write-docs
description: Writes clear, precise project documentation that describes behaviour and relationships in plain language. Use when authoring or revising docs such as READMEs, guides, references, or architecture notes.
user-invocable: true
disable-model-invocation: false
---

# Write Docs

## Core Contract

Write documentation that a reader can act on without prior context.
Describe how the system behaves and how its parts relate, not how the code is implemented, unless the doc is explicitly a technical/internals reference.
Match the target repo's existing docs conventions and location patterns. Follow `CLAUDE.md` / `AGENTS.md` on conflict.
Apply `terse`, `deslop`, and `bluf` throughout.

## Required Inputs

1. Subject and audience (who reads this, what they need to do).
2. Doc type: overview, how-to/guide, reference, or architecture note.
3. Scope boundaries (what to cover, what to leave out).
4. Where it lives (derive from repo conventions when unspecified).

## Workflow

1. Scan the repo for existing docs conventions: locations (`docs/`, `README.md`, package-level docs), file naming, heading style, and tone. Match them.
2. Confirm audience, doc type, and scope. State assumptions; ask only when a wrong guess changes structure or placement.
3. Draft the smallest structure that covers the scope. Lead with purpose and what the reader can do.
4. Write the body against the rules below.
5. Place the file in the location that matches repo cues. Link from an index or parent doc if one exists.
6. Self-review against the checklist. Revise.

## Writing Rules

- **Be succinct.** Cut filler and restatement. One idea per paragraph. (`terse`)
- **Plain but precise.** Use plain language. Name specific files, classes, functions, commands, and DB tables when they carry meaning; avoid vague nouns where a concrete name exists.
- **No AI jargon.** Avoid formulaic tells and buzzwords. (`deslop`)
- **Prefer prose.** Use diagrams and code examples only where they convey meaning more directly than text. Keep examples minimal and runnable.
- **Present tense, matter-of-fact.** Describe what the system does. Avoid past tense ("was changed") or future tense ("will support") that implies the implementation is in flux.
- **Behaviour over implementation.** Document the contract: inputs, outputs, effects, and relationships. Skip internals that churn, unless the doc is a technical reference.
- **No dangling references.** Drop ticket IDs, PR numbers, decision history, migration scenarios, and "recently/now/soon" framing. Docs describe the current state, not its path there.

## Recommended Practices

- **Lead with why and what**, then how. Put the most-needed information first, bottom-line-up-front (`bluf`).
- **Structure for scanning.** Descriptive headings, short paragraphs, lists for steps or options.
- **One term per concept.** Pick a name and use it consistently; do not alternate synonyms.
- **Second person, active voice** for instructions ("Run `x`", not "the user should run `x`").
- **Single source of truth.** Link instead of duplicating; co-locate docs with the code they describe so they stay current.
- **Show failure modes** and edge cases where a reader would otherwise get stuck.
- **Version-neutral language.** Avoid "new", "legacy", or dates that age badly.
- **Verify examples** against the actual interface before publishing.

## Safety Rules

- Never invent behaviour, flags, or file paths; confirm against the code or ask.
- Never contradict repo conventions or `CLAUDE.md` / `AGENTS.md`.
- Never leave a new doc unlinked when an index or parent doc exists.
- Never include ticket/PR/decision-history references in shipped docs.

## Templates

Start from the matching skeleton and adapt to repo conventions:

- [references/readme.md](references/readme.md): project or package entry point.
- [references/how-to.md](references/how-to.md): task-oriented guide.
- [references/reference.md](references/reference.md): API, command, config, or schema lookup.
- [references/architecture.md](references/architecture.md): structure and relationships of a system.

## Output Style

Report the doc type, final file path, why that location fits repo conventions, and any assumptions made or scope left out.
