# Portable development workflows with Pi adapters

## Purpose

Add a small set of reusable development workflows based on observed Pi usage: scoped discovery, plan-led work, focused parallel review, and review after a change. The workflows must be portable as human/agent instructions while providing Pi-specific saved chains that can launch the corresponding subagents.

The session-history audit found the strongest recurring pattern is implement/change → focused review → fix → re-review. It also found repeated scoped reconnaissance, plan-led implementation, and parallel specialist review. The audit used `~/.pi/agent/run-history.jsonl`; it did not synthesize all persisted transcripts, so its counts are lower bounds.

## User story & scenarios

As an agent user, I can select a named workflow and supply its target so that focused roles receive the right handoff and stop at the appropriate approval boundary.

Scenarios:

1. **Understand before planning.** A concrete change request needs repository reconnaissance and an implementation plan, but no edits.
2. **Review a bounded diff.** A branch, commit range, or uncommitted diff needs independent reviews for distinct concerns.
3. **Prepare a plan from external and local evidence.** A task depends on both current external documentation and local integration context.
4. **Review completed implementation.** An approved implementation needs parallel correctness, validation, and maintainability checks before a parent decides on fixes.
5. **Use another harness.** A harness without Pi or `pi-subagents` follows the same role contract and approval gates manually or through that harness’s native delegation system; it does not attempt to execute Pi chain syntax.

## Behaviour

### Workflow selection

- **Given** a user chooses a workflow and supplies a concrete target, **when** the workflow starts, **then** it gives each role the target, scope, success criteria, output format, and stop rule.
- **Given** the target leaves product, architecture, migration, or scope intent unresolved, **when** a workflow reaches that decision, **then** it stops for parent/user clarification rather than selecting an interpretation.
- **Given** a workflow is review-only, **when** it runs, **then** its children do not modify project/source files.

### Discovery to plan

- **Given** a concrete change request, **when** the discovery-to-plan workflow runs, **then** `scout` maps relevant files, conventions, tests, and uncertainties before `planner` writes a plan.
- **Given** the scout identifies unresolved non-verifiable intent, **when** the planner receives the handoff, **then** the plan records the question and does not authorize implementation.

### Parallel review

- **Given** a stable explicit diff scope, **when** the parallel-review workflow runs, **then** fresh-context reviewers inspect it independently for correctness/regressions, tests/validation, and simplicity/maintainability.
- **Given** reviewers disagree or recommend scope expansion, **when** their results return, **then** the parent synthesizes and accepts, defers, or rejects findings; no chain child decides that outcome.

### Research and local handoff

- **Given** an external dependency or current technical fact is material, **when** the research-handoff workflow runs, **then** `researcher` and `scout` run in parallel and a `context-builder` combines source-backed external evidence with local integration points.
- **Given** external evidence is not needed, **when** a user selects the workflow, **then** they use discovery-to-plan instead, avoiding unnecessary web research.

### Post-implementation review

- **Given** the implementation and its validation contract are supplied, **when** the workflow runs, **then** three fresh-context reviewers return evidence-backed findings without edits.
- **Given** findings need fixes, **when** the workflow ends, **then** the parent may launch one writer and, if warranted, another review round. This decision remains outside the static chain.

## QA

No automated chain tests are in scope for this change.

Manual validation after installation:

1. Run the installer and confirm every Pi adapter appears in `subagent({ action: "list" })` or `/run-chain`.
2. Run each read-only chain against a small, disposable repository and confirm its roles, named outputs, and handoffs are visible.
3. Run the review chains against a known diff; confirm reviewers make no source edits and have distinct, non-overlapping briefs.
4. Invoke the portable workflow instructions from one non-Pi installed harness; confirm they describe the same roles and approval gates without Pi-specific syntax.
5. Confirm a user’s existing Pi chains are preserved by the installer.

## Architecture

Use two layers:

```text
Portable workflow skill (role contracts, inputs, gates, outputs)
                    │
                    ├── Pi adapter: saved .chain.md workflow
                    └── Other harness: native delegation/manual execution
```

### Portable source of truth

Create one portable skill per workflow under `skills/agent/`. Each skill defines purpose, required inputs, role sequence, decision gates, prompts/outputs, safety constraints, and manual validation. It uses role names such as scout, planner, researcher, writer, and reviewer as capabilities, not Pi runtime identifiers. A non-Pi harness maps those roles to its available subagent mechanism or executes them sequentially.

### Pi adapters

Create static `.chain.md` files beneath `pi/chains/` that adapt the portable role contracts to `pi-subagents` builtins. They use Pi-only features—parallel groups, fresh-context reviews, named artifacts, and `{task}` / named-output handoffs—but never become the canonical workflow definition.

The adapters are deliberately read-only except for a separately parameterized approved-worker stage, if introduced after manual use validates the contract. V1 static chains stop before decisions such as accepting a plan, triaging review findings, or applying fixes. This preserves a single writer and parent authority.

### Installation

Extend `install.sh` with a chain artifact type that recursively symlinks repo `pi/chains/**/*.chain.md` (and future `.chain.json`) into `~/.pi/agent/chains/`, preserving relative paths. It must create destination parent directories and only manage matching workflow paths, so it does not replace unrelated user-local chains.

### Rejected alternative

Do not store only Pi `.chain.md` files. That would make the workflows directly executable in Pi but unusable as a portable procedure in Claude, Codex, Cursor, or another harness. Do not create one fully automatic implement → fix → re-review chain either: session evidence and pi-subagents guidance both require a parent to approve plans, synthesize review feedback, and control the sole writer.

## Affected areas

| Area | Change |
| --- | --- |
| `skills/agent/` | Add portable workflow skills and their role/approval contracts. |
| `pi/chains/` | Add Pi-specific static adapters, grouped by development workflow. |
| `install.sh` | Discover and recursively symlink chain artifacts without affecting unrelated local chains. |
| `README.md` | Add catalog rows for every portable workflow skill and document where Pi adapters install and how to invoke them. |
| `plans/pi-subagent-workflows.md` | This design record. |

Proposed initial portable skills and Pi adapters:

1. `discovery-to-plan` — `scout → planner`; read-only.
2. `parallel-diff-review` — three fresh-context reviewers in parallel; read-only.
3. `research-local-handoff` — `researcher + scout → context-builder`; read-only.
4. `post-implementation-review` — three fresh-context reviewers in parallel; read-only.

The existing pi-subagents prompt workflows (`review-loop`, `parallel-context-build`, `parallel-handoff-plan`, and `parallel-review`) remain available. The new artifacts supply stable local triggers and portable contracts tailored to the observed workflow set; they do not reimplement the extension runtime.

## Schema migrations

None.

## Implementation phases

### 1. Define portable contracts

Deliver the four `skills/agent/<workflow>/SKILL.md` artifacts with explicit input requirements, role boundaries, outputs, decision gates, and manual fallback instructions for non-Pi harnesses. Add matching `README.md` catalog rows.

**V&V gate:** every skill is discoverable through the existing installer and contains no Pi-only execution syntax in its canonical role contract.

### 2. Add Pi saved-chain adapters

Add one static `pi/chains/development/<workflow>.chain.md` adapter per portable skill. Use task variables, isolated output paths, named handoffs where required, `context: fresh` for independent reviewers, and read-only prompts for all V1 children.

**V&V gate:** after copying/linking the adapter directory to a test Pi agent directory, `subagent({ action: "list" })` discovers all four chains and their paths are collision-free.

### 3. Make chain installation portable and non-destructive

Implement recursive chain discovery/linking in `install.sh`; preserve each adapter’s relative directory and avoid changing chains not represented by a repo source file. Document the install destination and invocation in `README.md`.

**V&V gate:** run `bash install.sh` twice; the second run is idempotent, the four adapter links resolve to this repository, and a pre-existing unrelated local chain remains unchanged.

### 4. Manually exercise the workflow set

Run the four chains against small disposable targets, record any prompt, handoff, or chain-serialization defects, and refine contracts before adding writer/fix automation.

**V&V gate:** each workflow returns its stated artifact/result, makes no unintended source edits, and stops at its declared parent/user decision boundary.
