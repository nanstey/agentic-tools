---
name: deslop
description: Remove AI writing patterns from prose. Use this skill when writing, drafting, editing, reviewing, or revising any text to eliminate predictable AI tells, slop, and formulaic patterns.
user-invocable: true
disable-model-invocation: false
---

# Deslop: Remove AI Writing Patterns from Prose

Remove predictable AI patterns. Keep prose direct, specific, and human.

## When to Apply

- Requests to "deslop" or "make this sound human"
- Editing prose that feels formulaic, generic, or AI-like
- Reviewing drafts for AI tells before delivery

## Core Rules

### 1. Cut filler and meta

Delete throat-clearing, emphasis crutches, business buzzwords, and meta-commentary.  
Examples: "Here's the thing," "It's worth noting," "In this section, we'll explore."

### 2. Break formulaic patterns

Avoid binary contrasts ("Not X. Y."), negative listings ("Not a X. Not a Y. A Z."), dramatic fragmentation ("Speed. That's it. That's the tradeoff."), self-posed rhetorical questions ("The result? Devastating."), and anaphora/tricolon abuse. See [references/structures.md](references/structures.md) for patterns and fixes.

### 3. Remove AI tells

Cut telltale words and moves: magic adverbs, "serves as," fake ranges, inflated stakes, and invented labels.

Always replace these high-frequency vocabulary tells, even when they read as natural: "delve," "canonical" (use: standard, reference, definitive), "tapestry," "nuanced," "robust," "leverage," "landscape" (when it means "field"). Scan the text against [references/phrases.md](references/phrases.md) on every pass; do not skip it.

### 4. Prefer active voice and real actors

Name who did what. If needed, use "we" (scientific writing) or "you" (reader-facing prose).

### 5. Be specific

Replace vague claims with concrete facts. Avoid empty intensifiers and unnamed authority ("experts say").

In scientific writing, keep precise domain terms; remove buzzwords and soft abstractions.

### 6. Match register to context

Use the right voice for the audience.  
Blog/newsletter: concrete, reader-facing.  
Scientific: formal, sourced, and precise.

### 7. Vary rhythm

Mix sentence lengths and endings. Avoid metronomic cadence and stacked punchy fragments. No em dash.

### 8. Trust readers

State the point directly. Skip hand-holding, fake vulnerability, and repeated restatements.

## Quick Checks

- Too many adverbs or filler transitions? Cut.
- Passive or inanimate subjects doing human actions? Name the actor.
- "Not X, Y" or rhetorical Q+A? Rewrite as direct statements.
- Sentence lengths too uniform? Vary cadence.
- Em dash present? Replace with period/comma/parenthetical.
- Vague claims? Add concrete details.
- Formula endings ("In conclusion," "Despite these challenges")? Rewrite.
- Repeated metaphor or repeated point? Trim.
- Final pass: run `scripts/deslop-lint.sh` over the edited text (or paths). Every flagged candidate (e.g. "canonical," "delve," "serves as") is a miss; replace it or justify keeping it.

## Lint Script

`scripts/deslop-lint.sh` greps text for the vocabulary tells and signature phrases in `references/phrases.md` and prints each candidate with a suggested replacement. Run it as a final check; exit code 1 means candidates remain.

```bash
scripts/deslop-lint.sh draft.md          # scan a file
echo "$text" | scripts/deslop-lint.sh    # scan stdin
```

The term list lives at the top of the script and mirrors `references/phrases.md`; update both together.

## Reference Files

Consult [references/phrases.md](references/phrases.md) on every deslop pass; it is the source of truth for words and phrases to remove. Use the rest when you need detailed guidance:

- [references/phrases.md](references/phrases.md)
- [references/structures.md](references/structures.md)
- [references/tropes.md](references/tropes.md)
- [references/examples.md](references/examples.md)