---
name: vertical-slices
description: Breaks a change into small observable implementation increments with verification checkpoints. Use when a plan risks becoming a large horizontal batch of layer-by-layer work.
user-invocable: true
disable-model-invocation: false
---

# Vertical Slices

## Core Contract

Define the next planning wave of one to three independently observable implementation slices. Each slice crosses only the layers needed to expose meaningful behaviour and provides a concrete verification and review/steering checkpoint. This artifact defines slice boundaries and sequence; it is not a task-level implementation checklist.

Inspect the target repository read-only. Write only the approved planning artifact; target-repository `AGENTS.md` or `CLAUDE.md` instructions override this skill on conflict.

## Required Inputs

1. Change request and any available product, architecture, or program-design artifacts.
2. Observable user, API, CLI, or test outcomes.
3. Validation tooling and reviewer/steering expectations.
4. Optional opted-in reviewer and review mechanism.
5. Artifact path, or permission to propose one.

## Workflow

1. State that this is planning-only: do not edit source or dependencies. Treat implementation imperatives such as “build,” “implement,” “ship,” or “wire up” as slice-planning scope, not permission to execute. If there is no approved artifact path or permission to propose one, ask the user and stop.
2. Identify the smallest end-to-end behaviour that can be exposed and verified first.
3. Define one to three slices for the next planning wave. For each, state the observable outcome, layers crossed, focused implementation boundary, verification method, and review/steering checkpoint.
4. Reject a database-, service-, API-, or frontend-only phase unless it is explicitly justified bootstrap work. Restructure unjustified horizontal work into a vertical slice.
5. For justified bootstrap work that cannot itself expose behaviour, state why, bound it tightly, and require a verification checkpoint before the first observable slice.
6. Require each completed slice to record its verification result and, when review is requested, the opted-in reviewer's steering outcome before the next slice starts.
7. Treat later work as a re-planning checkpoint, not an uncontrolled batch; stop after the current wave and ask for steering before defining more slices.
8. Record every material uncertainty. Investigate and cite repository or source evidence where possible; otherwise ask the user. Do not finalize while one remains open.
9. Write the slice-boundary artifact to the approved path. Recommend `speclist` only when task-level execution steps are needed. Then stop and present the artifact for explicit user review; do not begin implementation or invoke a follow-on skill.

## Safety Rules

- Never edit source, tests, configuration, dependencies, or existing documentation.
- Never treat an implementation imperative as permission to edit source, invoke a build workflow, or proceed past the review gate.
- Never present horizontal layer sequencing as a vertical slice.
- Never use a slice to hide an unbounded implementation batch.
- Never invent validation capability or repository behaviour without evidence or user confirmation.
- Never assume user approval or a reviewer; a reviewer is author opt-in, but explicit user review is required before any follow-on work.
- Explicit approval of the slice plan selects a later, separate planning or build phase; it never authorizes source edits within this skill.
- Never finalize while a material sequencing or verification decision is unresolved.

## Output Style

Report artifact path; the current planning wave; each slice's observable outcome, validation, and checkpoint; the opted-in reviewer/mechanism when requested; any justified bootstrap work; unresolved-question resolution; review status; and one named optional next skill (or state that none is needed). Do not invoke another skill automatically; wait for explicit user approval before any follow-on work.
