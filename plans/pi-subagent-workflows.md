# Pi subagent development workflows

## Purpose

Add a small set of reusable **Pi subagent chains** for the development patterns
observed in real usage: scoped discovery → plan, focused parallel review,
research + local handoff, and post-implementation review. Ship them as saved
`.chain.md` files that Pi discovers at runtime, install them non-destructively
alongside the repo's existing agent profiles, and make them discoverable from
both the runtime (`/run-chain`, `subagent({ action: "list" })`) and the repo
catalog.

The session-history audit found the strongest recurring pattern is
implement/change → focused review → fix → re-review. It also found repeated
scoped reconnaissance, plan-led implementation, and parallel specialist review.
The audit used `~/.pi/agent/run-history.jsonl`; it did not synthesize all
persisted transcripts, so its counts are lower bounds.

This plan is intentionally **Pi-specific**. The workflows target `pi-subagents`
builtins and chain syntax directly; there is no portable/harness-agnostic layer.

## User story & scenarios

As a Pi user, I can run a named chain with a concrete target so that focused
roles receive the right handoff and stop at the appropriate approval boundary.

Scenarios:

1. **Understand before planning.** A concrete change request needs repository
   reconnaissance and an implementation plan, but no edits.
2. **Review a bounded diff.** A branch, commit range, or uncommitted diff needs
   independent reviews for distinct concerns.
3. **Prepare a plan from external and local evidence.** A task depends on both
   current external documentation and local integration context.
4. **Review completed implementation.** An approved implementation needs
   parallel correctness, validation, and maintainability checks before a parent
   decides on fixes.

## Behaviour

### Workflow selection

- **Given** a user runs a chain and supplies a concrete target, **when** the
  chain starts, **then** each step receives the target, scope, success criteria,
  output format, and stop rule.
- **Given** the target leaves product, architecture, migration, or scope intent
  unresolved, **when** a chain reaches that decision, **then** it stops for
  parent/user clarification rather than selecting an interpretation.
- **Given** a chain is review-only, **when** it runs, **then** its children do
  not modify project/source files.

### Discovery to plan

- **Given** a concrete change request, **when** `discovery-to-plan` runs,
  **then** `scout` maps relevant files, conventions, tests, and uncertainties
  before `planner` writes a plan.
- **Given** the scout identifies unresolved non-verifiable intent, **when** the
  planner receives the handoff, **then** the plan records the question and does
  not authorize implementation.

### Parallel review

- **Given** a stable explicit diff scope, **when** `parallel-diff-review` runs,
  **then** fresh-context reviewers inspect it independently for
  correctness/regressions, tests/validation, and simplicity/maintainability.
- **Given** reviewers disagree or recommend scope expansion, **when** results
  return, **then** the parent synthesizes and accepts, defers, or rejects
  findings; no chain child decides that outcome.

### Research and local handoff

- **Given** an external dependency or current technical fact is material,
  **when** `research-local-handoff` runs, **then** `researcher` and `scout` run
  in parallel and `context-builder` combines source-backed external evidence
  with local integration points.
- **Given** external evidence is not needed, **when** a user picks a workflow,
  **then** they use `discovery-to-plan` instead, avoiding unnecessary web
  research.

### Post-implementation review

- **Given** the implementation and its validation contract are supplied,
  **when** `post-implementation-review` runs, **then** three fresh-context
  reviewers return evidence-backed findings without edits.
- **Given** findings need fixes, **when** the chain ends, **then** the parent
  may launch one writer and, if warranted, another review round. This decision
  remains outside the static chain.

## QA

No automated chain tests are in scope for this change.

Manual validation after installation:

1. Run `bash install.sh` and confirm every chain appears in
   `subagent({ action: "list" })` and is runnable via `/run-chain`.
2. Run each read-only chain against a small, disposable repository and confirm
   its steps, named outputs, and handoffs are visible.
3. Run the review chains against a known diff; confirm reviewers make no source
   edits and have distinct, non-overlapping briefs.
4. Confirm the discoverability index (see Architecture) lists each chain with an
   accurate trigger and matches the chains actually on disk.
5. Confirm a user's existing, unrelated Pi chains are preserved by the
   installer.

## Architecture

Single layer: the `.chain.md` files are the canonical workflow definition. They
compose the agent profiles already shipped under `agents/` (`scout`, `planner`,
`researcher`, `context-builder`, `reviewer`, `worker`).

```text
pi/chains/development/*.chain.md   (canonical: steps, gates, outputs)
        │  compose
        ├── agents/*.md            (already installed agent profiles)
        │
        ├── install.sh             symlinks chains into ~/.pi/agent/chains/
        └── discoverability        runtime list + repo catalog + index skill
```

### Pi chains

Create static `.chain.md` files under `pi/chains/development/`. Each file uses
`pi-subagents` chain syntax directly: `## agent-name` step headers, `phase` /
`label` / `as` / `output` / `reads` / `model` config lines, `context: fresh`
for independent reviewers, and `{task}` / `{outputs.<name>}` handoffs. Parallel
review fan-out that needs concurrency beyond sequential steps uses the inline
parallel group form or a `.chain.json` sibling where required.

V1 chains are **read-only** and stop before decisions such as accepting a plan,
triaging review findings, or applying fixes. This preserves a single writer and
parent authority. An approved-worker stage may be added later, separately
parameterized, only after manual use validates the contract.

### Installation

Extend `install.sh` with a `chains` artifact type that recursively symlinks
repo `pi/chains/**/*.chain.md` (and future `.chain.json`) into
`~/.pi/agent/chains/`, preserving each file's relative path. It must create
destination parent directories and only manage matching workflow paths, so it
never replaces unrelated user-local chains. Because chains are Pi-only, the
`chains` type is attached to the `pi` harness row alongside `skills`/`agents`.

Note: the existing `config` type copies only the *top-level* files of `pi/`, so
`pi/chains/` is not swept up by config copying; the new `chains` type owns it
and symlinks (chains are static repo artifacts, unlike rewritten config files).

### Discoverability

Three complementary surfaces:

1. **Runtime** — once symlinked into `~/.pi/agent/chains/`, chains appear in
   `subagent({ action: "list" })` and run via `/run-chain <name> -- <task>`.
   Each chain's `name:` and `description:` frontmatter is the runtime label, so
   both must be accurate and intent-revealing.
2. **Repo catalog** — add a **Chains** section to `README.md` with one row per
   chain (name, path, description) so the catalog stays in sync with disk, per
   the AGENTS.md catalog policy.
3. **Index skill** — add a single Pi-facing skill,
   `skills/agent/subagent-workflows/SKILL.md`, that maps developer intent →
   chain (which chain to pick, its required target/inputs, and its stop rule).
   This is a thin selector/entry point, not a per-workflow contract; it keeps
   the chains usable without memorizing names.

### Rejected alternatives

- **Portable/harness-agnostic layer.** An earlier draft shipped a portable
  role-contract skill per workflow plus a derived Pi adapter. Dropped: this repo
  is comfortable being Pi-specific here, and the two-layer split doubled the
  artifacts and added a role-name indirection with no current consumer.
- **One fully automatic implement → fix → re-review chain.** Session evidence
  and `pi-subagents` guidance both require a parent to approve plans, synthesize
  review feedback, and control the sole writer.

## Affected areas

| Area | Change |
| --- | --- |
| `pi/chains/development/` | Add four static `.chain.md` workflow definitions. |
| `skills/agent/subagent-workflows/` | Add one Pi-facing index skill mapping intent → chain. |
| `install.sh` | Add a `chains` type on the `pi` harness that recursively symlinks chain artifacts without affecting unrelated local chains. |
| `README.md` | Add a **Chains** catalog section and the index-skill row; document install destination and `/run-chain` invocation. |
| `plans/pi-subagent-workflows.md` | This design record. |

Proposed initial chains (all read-only in V1):

1. `discovery-to-plan` — `scout → planner`.
2. `parallel-diff-review` — three fresh-context reviewers in parallel.
3. `research-local-handoff` — `researcher + scout → context-builder`.
4. `post-implementation-review` — three fresh-context reviewers in parallel.

The existing `pi-subagents` prompt workflows (`review-loop`,
`parallel-context-build`, `parallel-handoff-plan`, `parallel-review`) remain
available. These saved chains add stable, named local triggers tailored to the
observed workflow set; they do not reimplement the extension runtime.

## Schema migrations

None.

## Implementation phases

### 1. Add the Pi chains

Add the four `pi/chains/development/<workflow>.chain.md` files. Use step
headers, `phase`/`label`/`as`, isolated `output` paths, named `{outputs.*}`
handoffs where required, `context: fresh` for independent reviewers, and
read-only prompts for all V1 children. Give each accurate `name:` /
`description:` frontmatter for runtime discovery.

**V&V gate:** after linking the chain directory into a test Pi agent directory,
`subagent({ action: "list" })` discovers all four chains, names are
collision-free, and each runs via `/run-chain`.

### 2. Make chain installation non-destructive

Add the `chains` type to `install.sh` on the `pi` harness with a recursive
collector that emits `relpath<TAB>srcfile` for every `pi/chains/**/*.chain.md`,
and link them under `~/.pi/agent/chains/` preserving relative directories.
Preserve chains not represented by a repo source file.

**V&V gate:** run `bash install.sh` twice; the second run is idempotent, the
four chain links resolve to this repository, and a pre-existing unrelated local
chain remains unchanged.

### 3. Make chains discoverable

Add the `skills/agent/subagent-workflows/SKILL.md` index skill (intent → chain,
inputs, stop rule) and the **Chains** catalog section plus index-skill row in
`README.md`. Document the install destination and `/run-chain` invocation.

**V&V gate:** the index skill and README rows list exactly the chains on disk
with accurate triggers and inputs; the index skill installs and is discoverable
through the existing skills installer.

### 4. Manually exercise the workflow set

Run the four chains against small disposable targets, record any prompt,
handoff, or chain-serialization defects, and refine contracts before adding
writer/fix automation.

**V&V gate:** each chain returns its stated artifact/result, makes no unintended
source edits, and stops at its declared parent/user decision boundary.
