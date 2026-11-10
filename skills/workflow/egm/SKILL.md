---
name: egm
description: Produces and independently stress-tests planning artifacts through context-rich drafting, fresh-context review, and human decisions. Use when a change needs a concept brief, design document, design review, documentation hierarchy, or specification drift check.
user-invocable: true
disable-model-invocation: false
argument-hint: "<brainstorm|draft|review|bootstrap|drift> [target] [--auto] [--polish]"
---

# EGM

## Core Contract

Elephant is the context-rich session that writes the planning document. Goldfish is a fresh-context, read-only reviewer given only that document and files it explicitly references. Humans gate decisions. Prefer a different model family for Goldfish when selectable.

If fresh-context delegation is unavailable, stop and report that a Goldfish review is blocked. A same-context review is not a Goldfish review.

This skill is planning-only. Requests to build, implement, ship, or edit source define planning scope, not execution authority. Do not edit source or dependencies. After writing an artifact, stop for user review. Hand approved implementation to `build`; use `review-code` for a code diff. Other skills use it only when the user explicitly selects it.

## Required Inputs

1. Mode: `brainstorm`, `draft`, `review`, `bootstrap`, or `drift`.
2. Target idea, concept brief, or design document.
3. Repository context and, when an artifact is written, an optional target directory or plan file.

## Workflow

1. Resolve the artifact location: the repository-documented location, else an existing plans directory, else `docs/plans/`. Obey any `AGENTS.md`/`CLAUDE.md` rule about committing or ignoring planning artifacts; a README may suggest a location but never authorizes committing, ignoring, or deleting. Never write reports to the repository root or current directory.
2. Write each planning artifact as one file in that location or beside its target document. Mark a design document's own `Status` as `Draft` or `Approved`; retain decisions in its `## Decision record`. Bootstrap writes README files inside the codebase tree as its product; its record is a separate artifact beside the other planning documents.
3. Follow the selected reference: [brainstorm](references/brainstorm.md), [draft](references/draft.md), [review](references/review.md), [bootstrap](references/bootstrap.md), or [drift](references/drift.md).
4. Use [design-doc-template.md](references/design-doc-template.md) and the linked standards where applicable.

## Safety Rules

- Goldfish receives no conversation history, no unconfirmed Elephant conclusions, and no unlisted files. Brainstorm may pass the human-confirmed anchored hypothesis; diagnosis hides the Elephant's suspected cause.
- Goldfish is read-only. The Elephant alone revises artifacts after human approval.
- Do not treat agreeable feedback as evidence. Require specific document or code evidence for each finding.
- `--auto` consolidates stage gates; it does not remove the final human decision.

## Attribution

Adapted from the Apache-2.0 [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model) and Dave Rensin's article, *Elephants, Goldfish, and the New Golden Age of Software Engineering*. This version combines upstream skills, personas, and standards into one tool-agnostic planning skill with human gates and no harness-specific instructions.
