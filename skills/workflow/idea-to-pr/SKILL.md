---
name: idea-to-pr
description: Takes an idea end-to-end from discovery and planning through built, tested, and validated pull requests by chaining the planning, dev, and pr skills with pi-flows execution. Use when a feature idea or change request should be driven all the way to review-ready PRs.
user-invocable: true
disable-model-invocation: false
---

# Idea To PR

## Core Contract

Orchestrate existing skills as one pipeline from idea to review-ready PR(s); do no planning, editing, or PR work directly outside those skills.
Each delegated skill follows its own contract, gates, and safety rules; this skill sequences them, tracks state in the plan-folder README, and reports per-stage outcomes.
Execution inside a slice is delegated through pi-flows using a plan from `flow-design`; fall back to `build`'s own subagent delegation when pi-flows is unavailable.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The idea or change request.
2. Mode: `gated` (default — stop at every gate) or `autopilot` (pre-approved continuation between slices; never past a failed gate).
3. Constraints: deadline, budget ceiling for delegated flows, compatibility requirements.
4. Optional stages to skip.

If the idea is too vague to triage, stop and ask.

## Workflow

Resume support: given an existing plan folder, read its README (`Status`, `## Design`, `## Slices`) and resume at the first incomplete stage below instead of restarting.

### 1. Triage

Restate the idea. Classify:

- **Small**: single component, low risk, product intent clear → `proposal` path.
- **Large**: cross-component, risky, or product-ambiguous → decomposed path.

When unsure, ask. Size also selects the quality pass in stage 5 (on for large, off for small unless requested).

### 2. Plan folder

- `plan-init`: create the plan folder and README. The README is this pipeline's state machine.

### 3. Plan

- Small: `proposal`.
- Large: `product-review` → `system-architecture` → `program-design` → `vertical-slices`.
- Planning discovery may fan out read-only investigation via pi-flows (`recon`/`analyst`, designed by `flow-design`) when the codebase survey exceeds what the parent context should hold.

**GATE: explicit user approval of the plan.** Never proceed on silence, even in autopilot.

### 4. Specs

- `speclist`: one spec per slice under `<plan-folder>/specs/`. One slice = one PR.

### 5. Per slice, in order

1. `branch` or `worktree` (worktree when other slices are in flight).
2. `flow-design`: design the slice's execution flow from its spec — typically `evaluate` with an Anthropic operator, OpenAI Codex critic(s), the repo's test command as `checkCommand`, and explicit caps.
3. Execute the designed flow (or `build` when pi-flows is unavailable), honoring the plan's gates and budgets. Validation must pass before the slice advances.
4. Quality pass (large changes; opt-in for small): `principles` and/or `deep-review`, delegated to a fresh-context Codex-side reviewer per `flow-design`'s vendor split. Apply fixes through the same execution path.
5. `commit`, then `pr` (full checklist). Stack dependent slices via `gh-stack` / `pr-restack`.
6. Update the README slice row (`PR`, `Status`) and append design deviations to `## Decision log`.

**GATE (gated mode): per-slice review before starting the next dependent slice.** Autopilot continues automatically but still stops on any failed validation, failed CI, or sub-skill stop gate.

### 6. Close-out

- Set README `Status: done` when every slice row has a merged or review-ready PR.
- Offer `reflect` when the run hit avoidable friction.

After each stage, report its outcome before continuing. Stop and ask when any delegated skill hits its own gate, fails, or leaves the tree in an unexpected state.

## Safety Rules

- Never do work a delegated skill owns; sequence and report only.
- Never proceed past the plan-approval gate without explicit user approval, in any mode.
- Never advance a slice whose validation has not passed, or claim validation ran when it did not.
- Never run concurrent writers in one checkout; parallel slices require separate worktrees.
- Never execute a pi-flows plan that lacks a `why`, iteration caps, or a spend ceiling; send it back to `flow-design`.
- Never let the plan-folder README drift: update slice status at every transition.
- Never continue past a failed stage without user approval.

## Output Style

Report a per-stage checklist (done/skipped/blocked with one-line outcome), the plan folder path, per-slice status with PR URLs, delegated flow summaries (mode, cost, verdicts), and any unresolved blockers or open gates.
