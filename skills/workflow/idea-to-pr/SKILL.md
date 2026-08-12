---
name: idea-to-pr
description: Takes an idea end-to-end from discovery and planning through built, tested, and validated pull requests by chaining the planning, dev, and pr skills with pi-flows execution. Use when a feature idea or change request should be driven all the way to review-ready PRs.
user-invocable: true
disable-model-invocation: false
---

# Idea To PR

## Core Contract

Orchestrate existing skills as one pipeline from idea to review-ready PR(s); do no planning, editing, or PR work directly outside those skills.
Default to autonomous progress: the user's invocation authorizes normal discovery, planning, specification, implementation, validation, commits, and PR creation within the stated scope. `gated` mode is opt-in. Each delegated skill follows its safety rules; this skill sequences it, tracks state in the plan-folder README, and reports per-stage outcomes.
The top-level agent must protect its context during discovery and planning by delegating read-only reconnaissance and context-building to `pi-subagents` before invoking planning skills. Execution inside a slice may use pi-flows through a plan from `flow-design`; fall back to `build`'s own `pi-subagents` delegation when pi-flows is unavailable.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. The idea or change request.
2. Mode: `autopilot` (default — the invocation is approval to continue through ordinary stages) or `gated` (stop at stage and slice gates).
3. Constraints: deadline, budget ceiling for delegated flows, compatibility requirements.
4. Optional stages to skip.

If the idea is too vague to triage, stop and ask. In autopilot, do not ask again for ordinary planning-stage approval; the initial invocation is the explicit continuation authorization.

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

#### 3a. Delegated planning discovery

Before invoking a planning skill, the top-level agent delegates repository discovery through `pi-subagents`:

- **Small idea**: one fresh-context `scout` or `context-builder` for affected files, current behaviour, tests, and validation commands.
- **Large idea**: a small parallel fan-out of fresh-context, read-only agents with distinct scopes — typically request/scope, codebase/patterns, and validation/risks — followed by a `context-builder` or `planner` synthesis step.
- Launch these asynchronously where possible, use distinct output artifacts, and wait for all required findings before planning. Children must not edit source files or launch their own subagents.
- The synthesis handoff must include verified file/line evidence, affected boundaries, available test/browser commands, risks, unresolved questions, and a compact meta-prompt for the planning skill. The top-level agent uses this handoff instead of re-reading the entire repository into its own context.

Use the smallest fan-out that materially reduces parent context load; do not delegate trivial ideas where direct inspection is sufficient. If pi-subagents is unavailable, stop and report the setup problem rather than silently pretending planning was delegated.

#### 3b. Planning path

Pass the delegated discovery handoff to the appropriate planning path:

- Small: `proposal`.
- Large: `product-review` → `system-architecture` → `program-design` → `vertical-slices`.

Planning skills remain responsible for resolving uncertainties and writing their artifacts; delegated discovery is evidence, not approval.

In autopilot, pass this exact instruction with every planning-skill handoff: **“This is an `idea-to-pr` autopilot run. The user has explicitly authorized continuation through ordinary planning stages; write your artifact, report material risks, and return control to the pipeline without requesting a plan-approval prompt.”** The pipeline proceeds from the completed plan to specs without a separate approval. In `gated` mode, require explicit user approval of the completed plan before specs.

### 4. Specs

- `speclist`: one spec per slice under `<plan-folder>/specs/`. One slice = one PR.
- Instruct `speclist` to structure each spec with two distinct checklists, since checkbox ownership differs downstream: `## Implementation` (build items, ticked by the worker) and `## Test Scenarios` (Given/When/Then verification items, ticked by the reviewer/QA role).

### 5. Per slice, in order

1. `branch` or `worktree` (worktree when other slices are in flight).
2. Prepare the validation environment before asking `flow-design` to prove a gate: detect the repository package manager and lockfile, then install declared dependencies using its immutable/frozen-lockfile command (for pnpm: `pnpm install --frozen-lockfile`). Do this when dependencies are absent or a baseline command reports resolvable workspace/module imports. Do not change manifests or weaken the validation scope.
3. Run the prospective deterministic gate once. On a dependency-shaped failure (missing workspace package/module, missing executable, or absent generated dependency output), make one bounded environment-repair attempt using the detected package manager's immutable install, then rerun the same command. Record both attempts. If it still fails, classify the result: baseline code failure, lockfile/install failure, missing access/service, or unknown. Stop only after that classification; never ask the user to approve a narrower gate merely to continue.
4. `flow-design`: design the slice's execution flow from its spec and the repaired, runnable validation command — typically `evaluate` with an Anthropic operator, OpenAI Codex critic(s), the repo's test command as `checkCommand`, and explicit caps.
5. Execute the designed flow (or `build` when pi-flows is unavailable), honoring the plan's gates and budgets. Validation must pass before the slice advances. The worker (operator) checks off each `## Implementation` item as it lands and its validation passes; it never touches `## Test Scenarios`.
6. Runtime verification (when the slice exposes runnable behaviour): boot the app and exercise the spec's scenarios end-to-end — via `playwright-cli` for anything browser-facing, or the equivalent CLI/API calls otherwise. Every Given/When/Then in the slice spec must be observed passing against the running app, not inferred from unit tests. On failure, route the fix back through step 5. The reviewer/QA role checks off each `## Test Scenarios` item as it observes that scenario pass; when the verifying role cannot write, this skill ticks the item on the QA role's explicit per-scenario evidence, never on inference.
7. Evidence capture (user-facing UI slices): after runtime verification passes, capture screenshots/clips of the verified behaviour via `visual-capture` for the PR. Evidence is attached to the PR by `pr`/`pr-screenshots`, never committed.
8. Quality pass (large changes; opt-in for small): `principles` and/or `deep-review`, delegated to a fresh-context Codex-side reviewer per `flow-design`'s vendor split. Apply fixes through the same execution path.
9. `commit`, then `pr` (full checklist; `pr-screenshots` wires the captured evidence into the PR). Stack dependent slices via `gh-stack` / `pr-restack`.
10. Update the README slice row (`PR`, `Status`) and append design deviations to `## Decision log`.

**GATE (gated mode): per-slice review before starting the next dependent slice.** Autopilot continues automatically after ordinary planning, slice, and review transitions. It stops only for an unresolved material scope/design decision, destructive or externally consequential action not already authorized, unavailable required access/service, or a failed validation after the bounded repair loop.

### 6. Close-out

- Set README `Status: done` when every slice row has a merged or review-ready PR.
- Offer `reflect` when the run hit avoidable friction.

After each stage, report its outcome before continuing. In `gated` mode, stop for delegated-skill gates. In autopilot, continue through ordinary delegated-skill review gates and stop only for a material safety/scope decision, an unrepaired validation failure, unavailable required access/service, or an unexpected working-tree state.

## Safety Rules

- Never do work a delegated skill owns; sequence and report only.
- Never make the top-level context absorb a broad repository survey when a bounded `pi-subagents` discovery fan-out would materially reduce context load.
- Never use write-capable planning children for discovery; planning scouts and context-builders are read-only and must not launch nested subagents.
- Never proceed past the plan-approval gate in `gated` mode without explicit user approval; in autopilot, treat the initial invocation as that approval for ordinary planning transitions.
- Never advance a slice whose validation has not passed, or claim validation ran when it did not.
- Never stop on a dependency-shaped baseline failure before attempting the bounded, immutable dependency install and retry; never silently modify manifests, lockfiles, or validation scope during repair.
- Never skip runtime verification for a slice with runnable behaviour on the grounds that unit tests pass; tests supplement, not replace, observing the running app.
- Never capture PR screenshots or clips before the behaviour they show is verified; evidence documents verified behaviour, it does not substitute for verification.
- Never let a boot failure pass silently; if the app cannot start, the slice is blocked.
- Never let the implementing agent check off a test scenario, and never let any checkbox be ticked before its item is validated (implementation) or observed passing (scenario).
- Never open the slice's PR with unticked spec items; an unticked item is either unfinished work or a blocked scenario to surface.
- Never run concurrent writers in one checkout; parallel slices require separate worktrees.
- Never execute a pi-flows plan that lacks a `why`, iteration caps, or a spend ceiling; send it back to `flow-design`.
- Never let the plan-folder README drift: update slice status at every transition.
- Never continue past a failed stage without repair or user approval: in autopilot, attempt the prescribed bounded repair first; stop with evidence when it cannot restore the required gate.

## Output Style

Report a per-stage checklist (done/skipped/blocked with one-line outcome), the plan folder path, planning subagent assignments and handoff artifacts, per-slice status with PR URLs, delegated flow summaries (mode, cost, verdicts), and any unresolved blockers or open gates.
