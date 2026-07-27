---
name: system-architecture
description: Produces a bounded system architecture artifact covering boundaries, contracts, and data flow. Use when a change crosses components or carries consequential technical design choices.
user-invocable: true
disable-model-invocation: false
---

# System Architecture

## Core Contract

Create a high-level technical design that aligns how components, services, contracts, queues, and stores interact without prescribing internal program layout. It may start from settled product intent, or from a clearly technical request.

Inspect the target repository read-only. Write only the approved planning artifact; target-repository `AGENTS.md` or `CLAUDE.md` instructions override this skill on conflict.

## Required Inputs

1. Change request and available product or technical context.
2. Affected systems, interfaces, and constraints.
3. Compatibility, security, reliability, and rollout requirements.
4. Artifact path, or permission to propose one.
5. Optional opted-in reviewer and review mechanism.

## Workflow

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as “build,” “implement,” “ship,” or “wire up” as architecture scope, not permission to execute. If there is no approved artifact path or permission to propose one, ask the user and stop.
2. Map the existing boundaries and identify the decisions this change must settle.
3. Describe component interactions, contracts, data models/transformations, persistence effects, failure paths, compatibility, and validation/observability needs.
4. Use a sequence or data-flow diagram only when it makes an interaction clearer than concise prose.
5. Defer call stacks, file placement, internal types, and method signatures to `program-design`.
6. Record every material uncertainty. Investigate and cite repository or source evidence where possible; otherwise ask the user. Do not finalize while one remains open.
7. Write the architecture artifact to the approved path and optionally request the named reviewer's feedback. Then stop and present the artifact for explicit user review; do not begin implementation or invoke a follow-on skill.

## Safety Rules

- Never edit source, tests, configuration, dependencies, schemas, or existing documentation.
- Never treat an implementation imperative as permission to edit source, invoke a build workflow, or proceed past the review gate.
- Never invent an endpoint, data model, compatibility rule, or integration fact without evidence or user confirmation.
- Never turn architecture into a line-by-line implementation prescription.
- Never assume user approval or a reviewer; a reviewer is author opt-in, but explicit user review is required before any follow-on work.
- Explicit approval of the architecture selects a later, separate planning or build phase; it never authorizes source edits within this skill.
- Never finalize while a material architecture decision is unresolved.

## Output Style

Report artifact path, settled boundaries and contracts, diagrams used, decisions deferred to program design, unresolved-question resolution, review status, and one named optional next skill (or state that none is needed). Do not invoke another skill automatically; wait for explicit user approval before any follow-on work.
