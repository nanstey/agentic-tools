---
name: product-review
description: Turns a product request into a concise user-centred review with outcomes, success signals, and scope. Use when an agent misunderstanding the product intent would be expensive.
user-invocable: true
disable-model-invocation: false
---

# Product Review

## Core Contract

Turn an informal request into a short product-facing artifact that settles what to build and why before technical design begins. Keep the artifact grounded in user experience, not implementation choices.

Inspect the target repository read-only. Write only the approved planning artifact; target-repository `AGENTS.md` or `CLAUDE.md` instructions override this skill on conflict.

## Required Inputs

1. Product request or problem statement.
2. Intended users and affected workflow, if known.
3. Available product evidence, constraints, and success signals.
4. Artifact path, or permission to propose one.
5. Optional opted-in reviewer and review mechanism.

## Workflow

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as “build,” “implement,” “ship,” or “wire up” as review scope, not permission to execute. If there is no approved artifact path or permission to propose one, ask the user and stop.
2. Restate the problem in the user's terms and identify the affected workflow.
3. Define the desired outcome and the observable success signal after shipping.
4. Separate scope, non-goals, workflow steps, and exits from technical ideas. Park technical ideas that do not affect the outcome as follow-up questions for `system-architecture`.
5. Record every material uncertainty. Investigate and cite repository or source evidence where possible; otherwise ask the user. Do not finalize while one remains open.
6. When a user-visible interaction cannot be settled in prose, offer a rough, non-integrated HTML mockup or equivalent visual artifact. Require an explicitly approved planning/mockup path before writing it.
7. If feasibility blocks a product decision, stop and recommend `prototype` or `system-architecture`.
8. Write the review to the approved path and optionally request the named reviewer's feedback. Then stop and present the artifact for explicit user review; do not begin implementation or invoke a follow-on skill.

## Safety Rules

- Never edit application source, tests, configuration, dependencies, or existing documentation.
- Never treat an implementation imperative as permission to edit source, invoke a build workflow, or proceed past the review gate.
- Never implement UI; a mockup is disposable planning evidence, not production code.
- Never substitute technical design for a user outcome.
- Never assume user approval or a reviewer; a reviewer is author opt-in, but explicit user review is required before any follow-on work.
- Explicit approval of the review selects a later, separate planning or build phase; it never authorizes source edits within this skill.
- Never finalize while a material product decision is unresolved.

## Output Style

Report artifact path, user problem, desired outcome, success signal, scope/non-goals, unresolved-question resolution, review status, and one named optional next skill (or state that none is needed). Do not invoke another skill automatically; wait for explicit user approval before any follow-on work.
