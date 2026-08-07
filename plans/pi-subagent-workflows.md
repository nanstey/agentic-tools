# Tiered development workflows on pi-flows

## Purpose

Add a small, tiered set of reusable development workflows built on
[`pi-flows`](https://github.com/Thulr/pi-flows) for the patterns observed in real
usage: scoped discovery, plan-led work, focused parallel review, and — the
dominant pattern — implement → review → fix until an independent reviewer is
clean. Ship them as named `pi-flows` **presets** (plus custom flow agents where a
bundled one does not fit), install them non-destructively, and make them
discoverable from both the `pi-flows` runtime (`/flows`, `flow list:true`) and
the repo catalog.

This plan supersedes the earlier `pi-subagents` chain approach. `pi-subagents`
chains are static and cannot loop or gate, so the core review-fix-until-clean
pattern had to be emulated by parent orchestration. `pi-flows` provides that
control flow natively — a generator-evaluator `evaluate` loop with an
independent critic, a deterministic `checkCommand` gate, and a hard iteration
cap — so it is the better engine for the workflow set.

This plan is Pi-specific by design; there is no harness-agnostic layer.

## Why pi-flows

- **Native iteration and gates.** `evaluate` runs a builder and an independent
  critic in separate child contexts, optionally gated on a shell command
  (`npm test` exit 0), revising under a hard `maxIterations` cap. `loop`,
  `workflow`, and `worktree` cover the heavier long-horizon shapes.
- **Enforced isolation.** Read-only agents run without shell/write tools;
  concurrent writers cannot share a checkout unless explicitly opted in.
- **Bounded and auditable.** Count, concurrency, depth, token, and USD ceilings
  are enforced (`BUDGET_EXCEEDED`); handoffs between agents are redacted and
  scanned for injection; runs emit JSONL traces and `/flows report`.
- **One interface, many shapes.** `single`, `parallel`, `chain`, `evaluate`,
  `orchestrate`, `dossier`, `workflow`, `worktree`, etc. all use the same `flow`
  tool, so a tier ladder is expressible without new syntax per workflow.

## Tier ladder

Workflows are organized as an escalation ladder — pick the least coordination
the task needs, escalate only when isolation, independent evidence, or gated
iteration changes correctness. Model **tier** (`fast` / `capable` / `deep`)
scales with the work, not hard-coded model ids.

| Tier | Workflow | pi-flows shape | Model tiers | Writes? |
| --- | --- | --- | --- | --- |
| T1 Scout | `discovery` | `single` `recon` (or `scout` preset) | fast | no |
| T2 Review | `diff-review` | `code-review` preset (two `overwatch`: standards + spec) | capable | no |
| T2 Plan | `discovery-to-plan` | `chain` `recon → strategist` | recon fast, strategist deep | no |
| T3 Research | `research-handoff` | `dossier` / `orchestrate` over sources → synthesis | capable, synth deep | no |
| T4 Verified build | `review-fix` | `evaluate` `operator` + `redteam` critic + optional `checkCommand` | operator capable, critic deep | yes (bounded) |
| T5 Gated/isolated | (future) release/migration | `workflow` (phases + approval) / `worktree` | per role | yes (isolated) |

T1–T3 are read-only. T4 is the review-fix-until-clean loop and the primary
deliverable; it is the only tier that mutates the tree, bounded by the critic,
the deterministic gate, and `maxIterations`. T5 is scoped out of V1.

## User story & scenarios

As a Pi user, I invoke a named preset with a concrete target and get a bounded,
auditable result at the right tier, stopping at the correct decision boundary.

1. **Understand before touching.** Read-only recon of a code path (T1).
2. **Review a bounded diff.** Independent standards + spec review of a resolved
   Git range, exactly once, no fixes (T2).
3. **Plan a change.** Recon then a `strategist` plan; unresolved product/scope
   intent is recorded as a question, not guessed (T2).
4. **Reconcile external + local evidence.** Source-specific extraction then
   cited synthesis that preserves conflicts (T3).
5. **Implement until clean.** Builder + independent critic (+ `npm test` gate)
   iterate until `VERDICT: PASS` or the cap, returning the last attempt (T4).

## Behaviour

### Tier selection and bounds

- **Given** a target, **when** a preset runs, **then** it applies its declared
  mode, model tiers, and ceilings; it never silently loosens capture, trust, or
  budget.
- **Given** product, architecture, migration, or scope intent is unresolved,
  **when** a workflow reaches that decision, **then** it surfaces the question
  rather than choosing an interpretation.
- **Given** a read-only tier (T1–T3), **when** it runs, **then** its agents have
  no write/shell tools and cannot mutate the repo.

### Verified build (T4, evaluate)

- **Given** an implementation goal and (optionally) a `checkCommand`, **when**
  `review-fix` runs, **then** `operator` builds, an independent `redteam` critic
  judges only the operator's output, and on `REVISE` the operator revises in
  place with the critique.
- **Given** a `checkCommand`, **when** a round runs, **then** a non-zero exit is
  an automatic `REVISE` (its output becomes the critique) and `PASS` requires
  both the gate and the critic(s).
- **Given** the loop does not converge, **when** `maxIterations` is reached,
  **then** it returns the last attempt with the outstanding critique — it never
  loops unbounded.

### Diff review (T2, one-shot)

- **Given** a Git range, **when** `diff-review` runs, **then** the range is
  resolved to immutable commit IDs and two reviewers cover it once; reviewers
  make no edits and the result is `CLEAN`, `FINDINGS`, or `PARTIAL`. Triage of
  findings stays with the parent/user.

## QA

No automated flow tests are in scope. Manual validation after installation:

1. `flow showConfig:true` and `flow list:true` resolve the pi-flows extension
   and its agents; `/flows status all` reports the preset/agent directories with
   no shadowing or frontmatter errors for our artifacts.
2. Each read-only preset (T1–T3) runs against a small disposable repo and makes
   no source edits.
3. `review-fix` (T4) runs against a trivial goal with a `checkCommand`, iterates,
   and terminates on `PASS` or the cap; the tree is left coherent.
4. Catalog rows and the index skill list exactly the presets on disk with
   accurate tiers, inputs, and stop rules.
5. A user's existing, unrelated flow presets/agents are preserved by the
   installer.

## Architecture

```text
pi-flows extension (flow tool + bundled agents)
        │
        ├── pi/flow-presets/*.md      our tiered workflows (frontmatter + JSON body)
        ├── pi/flow-agents/*.md       custom agents only where a bundled one is unfit
        ├── settings.json packages    declares the pi-flows package for pi to load
        ├── install.sh                symlinks presets/agents; ensures the package is listed
        └── discoverability           /flows + repo catalog + index skill
```

### Presets as the canonical workflows

Each tier is a `pi-flows` preset: a markdown file with `name` / `description` /
`overrides` frontmatter and a JSON body that fixes the mode, roles, model tiers,
and bounds while leaving `{task}` and safe caller controls open. Presets are the
canonical definition; they compose `pi-flows`' bundled agents (`recon`,
`strategist`, `overwatch`, `operator`, `redteam`, `debrief`, …).

### Custom agents only where needed

Prefer the bundled roster. Add a `pi/flow-agents/<name>.md` only when a
workflow needs a persona the bundled agents do not cover (e.g. a stricter
maintainability critic). Custom agents use `tier` for portable model selection,
not pinned ids.

### Installation

- Add `pi-flows` to the `packages` list in `pi/settings.json` so `pi` loads the
  extension on launch (copied with the rest of pi config).
- Extend `install.sh` with two symlink types on the `pi` harness:
  `flow-presets:$PI_AGENT_DIR/flow-presets` and
  `flow-agents:$PI_AGENT_DIR/flow-agents`, recursively linking
  `pi/flow-presets/**/*.md` and `pi/flow-agents/**/*.md` while preserving
  relative paths. It manages only our files, leaving unrelated user presets and
  agents untouched.

### Discoverability

1. **Runtime** — presets and agents appear in `flow list:true`, `/flows`, and
   `/flows status all`; presets run by name. Accurate `description` frontmatter
   is what the parent model reads when choosing.
2. **Repo catalog** — a **Flows** section in `README.md`, one row per preset
   (name, tier, path, description), kept in sync with disk per AGENTS.md policy.
3. **Index skill** — one Pi-facing skill,
   `skills/agent/flow-workflows/SKILL.md`, mapping intent → tier/preset with
   required inputs and stop rules. A thin selector, not a per-workflow contract.

### Rejected alternatives

- **Keep the `pi-subagents` chain approach.** Chains are static — no loop, no
  conditional, no deterministic gate — so the dominant review-fix-until-clean
  pattern could only be emulated by hand-rolled parent orchestration. `pi-flows`
  `evaluate` provides it natively with an independent critic and a hard cap.
- **A harness-agnostic role-contract layer.** Out of scope; this repo is
  comfortable being Pi-specific here, and the abstraction has no current
  consumer.
- **A long-lived autonomous swarm / peer-to-peer agents.** `pi-flows` is a star
  topology (parent delegates bounded work, children return, parent decides) and
  we adopt that boundary deliberately.

## Affected areas

| Area | Change |
| --- | --- |
| `pi/settings.json` | Add `pi-flows` to the `packages` list so pi loads the extension. |
| `pi/flow-presets/` | Add the tiered workflow presets (T1–T4). |
| `pi/flow-agents/` | Add custom flow agents only where a bundled agent is unfit. |
| `skills/agent/flow-workflows/` | Add one Pi-facing index skill mapping intent → tier/preset. |
| `install.sh` | Add `flow-presets` and `flow-agents` symlink types on the `pi` harness; non-destructive, relative-path preserving. |
| `README.md` | Add a **Flows** catalog section and the index-skill row; document install destination and `/flows` invocation. |
| `plans/pi-subagent-workflows.md` | This design record (retitled for pi-flows). |

### Migration note

The in-progress `pi-subagents` artifacts on this branch —
`pi/chains/development/review-fix.chain.md` and the `chains` symlink type in
`install.sh` — are superseded by this plan. Either remove them, or keep the
`review-fix` chain as a lightweight `pi-subagents` fallback and clearly document
that the canonical loop is the `pi-flows` `evaluate` preset. Decide during
Phase 1; do not maintain two engines for the same workflow silently.

## Schema migrations

None.

## Implementation phases

### 1. Load pi-flows and reconcile the branch

Add `pi-flows` to `pi/settings.json` packages. Decide the fate of the
`pi-subagents` `review-fix` chain and its installer `chains` type (remove or
demote to documented fallback). Confirm `flow showConfig:true` / `flow list:true`
resolve after `install.sh` copies settings and pi installs the package.

**V&V gate:** `pi-flows` loads; `/flows status all` is clean; the branch no
longer implies two canonical engines for review-fix.

### 2. Author the tiered presets

Add `pi/flow-presets/*.md` for T1–T4 (`discovery`, `diff-review`,
`discovery-to-plan`, `research-handoff`, `review-fix`). Set mode, roles, model
tiers, `maxIterations`, and any `checkCommand` per the tier table. Add custom
`pi/flow-agents/*.md` only where a bundled agent is unfit.

**V&V gate:** every preset appears in `flow list:true` with an accurate
description; each read-only preset makes no edits; `review-fix` iterates and
terminates on `PASS` or cap against a disposable target.

### 3. Make installation non-destructive

Add `flow-presets` and `flow-agents` symlink types to `install.sh` on the `pi`
harness with recursive, relative-path-preserving collectors. Run twice;
idempotent; unrelated user presets/agents unchanged.

**V&V gate:** the second `bash install.sh` is idempotent, our links resolve to
this repo, and a pre-existing unrelated user preset/agent remains intact.

### 4. Make workflows discoverable

Add `skills/agent/flow-workflows/SKILL.md` (intent → tier/preset, inputs, stop
rule) and the **Flows** catalog section plus index-skill row in `README.md`.

**V&V gate:** the index skill and README rows list exactly the presets on disk
with accurate tiers and inputs; the index skill installs via the existing skills
installer.

### 5. Exercise the ladder

Run each tier against small disposable targets; record prompt, handoff, gate, or
budget defects; refine before considering T5 (workflow/worktree).

**V&V gate:** each workflow returns its stated result at its tier, read-only
tiers make no edits, and `review-fix` leaves a coherent, validated tree or
surfaces a decision it may not make.
