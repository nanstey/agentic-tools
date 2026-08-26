---
name: bluf
description: Structures a message bottom-line-first, stating the main point or request before the context that supports it. Use when a reader must grasp the outcome, decision, or ask before any supporting detail.
user-invocable: true
disable-model-invocation: false
---

# BLUF (Bottom Line Up Front)

## Core Contract

Lead with the bottom line, then follow with only the context needed to support it.
Present conclusions before the material that justifies them (deductive, not inductive).
A drafting order, not a visible template: the seams must never show in shipped prose. Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Structure

1. **Bottom line** — the main point, decision, request, or answer, in the first sentence.
2. **Context** — the minimum background, evidence, or caveats that make the bottom line actionable, after it.

## When to Use

- Summaries, reports, PR/issue descriptions, status updates, and any `Output Style` section.
- Communicating up: a time-constrained reader must know the point and what is asked of them immediately.
- Apply fractally: each section, paragraph, and bullet also leads with its own bottom line.

## Guardrails

- Never open with background, motivation, or a chronology that builds toward the point.
- Never label the parts (`Bottom line:` / `Context:`) in shipped prose; the ordering carries it.
- Cut context that does not change what the reader does; BLUF is bottom-line-first, not bottom-line-only.

## Output Style

State the point first, support it second. The reader should be able to act after the first sentence.
