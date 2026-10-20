---
name: planning
description: Plans a change end-to-end by sizing it and composing the focused planning skills it needs into one plan folder, from a single proposal up to the full product, architecture, design, slice, and spec chain. Use when a change needs a plan and the right depth of planning is not yet decided.
argument-hint: "[change request] [--tier small|medium|large]"
user-invocable: true
disable-model-invocation: false
---

# Planning

## Core Contract

Size a change, then run only the planning skills that size needs, in order, into one plan folder. This skill owns routing and the single review gate. It owns no design content: each stage's artifact contract stays in its own skill.

Planning-only. Implementation imperatives such as "build," "implement," "ship," or "wire up" define planning scope, not execution authority. Never edit source, tests, configuration, or dependencies. Never invoke `build`, `idea-to-pr`, or any implementation workflow. Stop for explicit user review after the plan; approval selects a later, separate phase and never authorizes source edits here. Exception: when the invoking skill states that the user authorized planning transitions (for example an `idea-to-pr` autopilot run), return the plan to that caller instead of waiting for the user. The caller, not this skill, starts any later phase.

Target-repository `CLAUDE.md` / `AGENTS.md` override this skill on conflict.

## Required Inputs

1. Change request or problem statement.
2. Optional tier override (`--tier`), plan folder, and opted-in reviewer.

## Tiers

Pick the smallest tier whose signals fit; one strong signal of a higher tier is enough to move up. Record the tier and the evidence for it.

| Tier | Signals | Stages |
| --- | --- | --- |
| small | One component; behaviour clear; no new contract; one to three phases. | `proposal` |
| medium | Clear intent, but a contract, data flow, or code shape carries risk; two to four slices. | Focused stages chosen per concern (see Selection) → `vertical-slices` |
| large | Product intent ambiguous, or the change crosses components, services, or stores; many slices. | `product-review` → `system-architecture` → `program-design` → `vertical-slices` |

All tiers end at `speclist` (one spec per slice) unless the user wants the plan only. A small plan with a single phase may skip `speclist`; its `proposal.md` phase is the spec.

### Selection (medium)

Add only the stages whose question is open:

- Who is it for or what counts as success is unclear → `product-review`.
- Components, contracts, persistence, or rollout are affected → `system-architecture`.
- Control flow, file placement, or interfaces could go wrong → `program-design`.
- Always `vertical-slices` when more than one slice results.

Never mix `proposal` with a focused skill for the same concern. If a concern outgrows `proposal.md`, promote it and log the move in the README `## Decision log`.

## Workflow

1. State the planning-only guardrail. Restate the request.
2. Triage: read the minimum code and docs needed to apply the Tiers table. Do not scan broadly; stage skills do their own discovery.
3. Resolve open questions that decide the tier or the whole plan. Ask the user only for intent or priorities that evidence cannot settle.
4. Run `plan-init` once to create or reuse the plan folder and README. Pass the folder to every later stage so none resolves it again.
5. Run the selected stages in order. Give each stage: the request, the plan folder, the prior artifact paths (not their full text), and this instruction: "This is a `planning` composed run. Write your assigned artifact, upsert your README rows, report material risks, and return control without requesting plan approval."
6. Between stages, read the returned packet. If a stage shows the tier was wrong (new cross-boundary risk, or the stage proves unneeded), adjust the remaining stages, and log the change in `## Decision log`. Do not rerun finished stages.
7. After the last stage, check the README: every artifact on disk has a `## Design` row, `## Slices` matches the slice list, and every slice has a `Spec` link when `speclist` ran. Fix drift.
8. Stop and present the plan for review, or return it to an authorized caller (see Core Contract).

## Safety Rules

- Never edit source, tests, configuration, or dependencies.
- Never invoke an implementation workflow or follow-on skill after the plan; name `build` or `idea-to-pr` as an optional next step only.
- Never run a stage the tier does not need; never skip a stage whose question is open.
- Never duplicate a concern across `proposal.md` and a focused doc.
- Never let a stage resolve its own plan folder when `plan-init` already ran.
- Never finalize while a material open question remains unresolved or unlabelled as an assumption.
- Never assume a reviewer or user approval.

## Output Style

Lead with the plan folder path. Then report the tier and why, the stages run and skipped, the slice list, how open questions were resolved, any tier change, and the review status. Name one optional next skill, or none. Wait for explicit approval.
