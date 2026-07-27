---
name: program-design
description: Produces a concise code-shape design with call paths, file placement, and key interfaces. Use when an implementation could go wrong despite a settled architecture or local requirement.
user-invocable: true
disable-model-invocation: false
---

# Program Design

## Core Contract

Translate an available architecture or self-contained change request into the high-leverage shape of code before implementation: changed control flow, file layout, key types, signatures, invariants, error boundaries, and test seams. This is not an exhaustive implementation spec.

Inspect the target repository read-only. Write only the approved planning artifact; target-repository `AGENTS.md` or `CLAUDE.md` instructions override this skill on conflict.

## Required Inputs

1. Settled architecture, local requirement, or prior planning artifact.
2. Relevant repository areas and constraints.
3. Validation expectations and compatibility requirements.
4. Artifact path, or permission to propose one.
5. Optional opted-in reviewer and review mechanism.

## Workflow

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as “build,” “implement,” “ship,” or “wire up” as program-design scope, not permission to execute. If there is no approved artifact path or permission to propose one, ask the user and stop.
2. Inspect existing call paths, file layout, types, conventions, and test seams.
3. Draft a call-stack tree for changed orchestration or control flow; use diff notation when it clarifies the change.
4. Draft a file-tree diff and only the key types, signatures, invariants, and error boundaries that constrain implementation.
5. Identify validation seams and the smallest checks that prove the proposed design.
6. For an unsupported decision that would constrain implementation, present bounded alternatives and ask the user rather than choosing one.
7. Record every material uncertainty. Investigate and cite repository or source evidence where possible; otherwise ask the user. Do not finalize while one remains open.
8. Write the program-design artifact to the approved path and optionally request the named reviewer's feedback. If no material decisions remain, recommend `vertical-slices` as the next task. Then stop and present the artifact for explicit user review; do not begin implementation or invoke a follow-on skill.

## Safety Rules

- Never edit source, tests, configuration, dependencies, or existing documentation.
- Never treat an implementation imperative as permission to edit source, invoke a build workflow, or proceed past the review gate.
- Never invent repository conventions, types, or call paths without evidence or user confirmation.
- Never prescribe incidental implementation detail that does not reduce a material risk.
- Never assume user approval or a reviewer; a reviewer is author opt-in, but explicit user review is required before any follow-on work.
- Explicit approval of the program design selects a later, separate planning or build phase; it never authorizes source edits within this skill.
- Never finalize while a material program-design decision is unresolved.

## Output Style

Report artifact path, call-path and file-layout decisions, key interfaces/invariants, validation seams, unresolved-question resolution, review status, and `vertical-slices` as the recommended next task when no material decisions remain. Do not invoke another skill automatically; wait for explicit user approval before any follow-on work.
