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

This skill is planning-only. Requests to build, implement, ship, or edit source define planning scope, not execution authority. Do not edit source or dependencies. After writing an artifact, stop for user review. Hand approved implementation to `build`; use `review-code` for a code diff. `idea-to-pr` and `planning` may call `draft` and `review`.

## Required Inputs

1. Mode: `brainstorm`, `draft`, or `review`.
2. Target idea, concept brief, or design document.
3. Repository context and a plan folder when an artifact is written.

## Workflow

1. Resolve the artifact location with `plan-dir`; use the `plan-init` folder layout. Never write reports to the repository root or current directory.
2. Register each artifact in the plan README `## Design` index as `egm-design`, status `draft` or `done`. Set approved documents to `Approved`.
3. Follow the selected reference: [brainstorm](references/brainstorm.md), [draft](references/draft.md), [review](references/review.md), [bootstrap](references/bootstrap.md), or [drift](references/drift.md).
4. Use [design-doc-template.md](references/design-doc-template.md) and the linked standards where applicable.

## Safety Rules

- Goldfish receives no conversation history, Elephant hypothesis, or unlisted files.
- Goldfish is read-only. The Elephant alone revises artifacts after human approval.
- Do not treat agreeable feedback as evidence. Require specific document or code evidence for each finding.
- `--auto` consolidates stage gates; it does not remove the final human decision.

## Attribution

Adapted from the Apache-2.0 [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model) and Dave Rensin's article, *Elephants, Goldfish, and the New Golden Age of Software Engineering*. This version combines upstream skills, personas, and standards into one tool-agnostic planning skill; uses plan folders and human gates; and removes harness-specific instructions.
