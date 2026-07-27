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

1. Map the existing boundaries and identify the decisions this change must settle.
2. Describe component interactions, contracts, data models/transformations, persistence effects, failure paths, compatibility, and validation/observability needs.
3. Use a sequence or data-flow diagram only when it makes an interaction clearer than concise prose.
4. Defer call stacks, file placement, internal types, and method signatures to `program-design`.
5. Record every material uncertainty. Investigate and cite repository or source evidence where possible; otherwise ask the user. Do not finalize while one remains open.
6. Write the architecture artifact to the approved path and optionally request the named reviewer's feedback.

## Safety Rules

- Never edit source, tests, configuration, dependencies, schemas, or existing documentation.
- Never invent an endpoint, data model, compatibility rule, or integration fact without evidence or user confirmation.
- Never turn architecture into a line-by-line implementation prescription.
- Never assume a reviewer or approval; review is author opt-in.
- Never finalize while a material architecture decision is unresolved.

## Output Style

Report artifact path, settled boundaries and contracts, diagrams used, decisions deferred to program design, unresolved-question resolution, and one named optional next skill (or state that none is needed). Do not invoke another skill automatically.
