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

1. Restate the problem in the user's terms and identify the affected workflow.
2. Define the desired outcome and the observable success signal after shipping.
3. Separate scope, non-goals, workflow steps, and exits from technical ideas. Park technical ideas that do not affect the outcome as follow-up questions for `system-architecture`.
4. Record every material uncertainty. Investigate and cite repository or source evidence where possible; otherwise ask the user. Do not finalize while one remains open.
5. When a user-visible interaction cannot be settled in prose, offer a rough, non-integrated HTML mockup or equivalent visual artifact. Require an explicitly approved planning/mockup path before writing it.
6. If feasibility blocks a product decision, stop and recommend `prototype` or `system-architecture`.
7. Write the review to the approved path and optionally request the named reviewer's feedback.

## Safety Rules

- Never edit application source, tests, configuration, dependencies, or existing documentation.
- Never implement UI; a mockup is disposable planning evidence, not production code.
- Never substitute technical design for a user outcome.
- Never assume a reviewer or approval; review is author opt-in.
- Never finalize while a material product decision is unresolved.

## Output Style

Report artifact path, user problem, desired outcome, success signal, scope/non-goals, unresolved-question resolution, and one named optional next skill (or state that none is needed). Do not invoke another skill automatically.
