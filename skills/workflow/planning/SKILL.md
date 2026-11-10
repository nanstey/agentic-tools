---
name: planning
description: Plans a change as one short document. Runs discovery, asks the user the product decisions it cannot settle in one batch, then writes decisions, acceptance criteria, approach, and risks. Use when a change needs a plan before building, from a small feature to a cross-component effort.
argument-hint: "[change request]"
user-invocable: true
disable-model-invocation: false
---

# Planning

## Core Contract

Produce one plan document per effort. The plan states what to build, why, which decisions are settled, how success is observed, and what could go wrong. It does not script the implementation: the builder reads the code and chooses file edits, signatures, and task order.

Planning-only. Words such as "build," "implement," or "ship" in the request define scope, not permission to execute. Never edit source, tests, configuration, or dependencies. Never invoke `build`, `idea-to-pr`, or another implementation workflow; name one as an optional next step. Exception: when the invoking skill states that the user authorized planning transitions (for example an `idea-to-pr` autopilot run), return the plan to that caller instead of waiting.

Target-repository `AGENTS.md` / `CLAUDE.md` override this skill on conflict.

## Required Inputs

1. Change request or problem statement.
2. Optional: plan file path, or a note that no plan file is wanted.

## Workflow

### 1. Size

Pick the smallest fit and record the evidence.

| Size | Signals | Output |
| --- | --- | --- |
| Trivial | One place, behaviour obvious, no product choice. | Inline: state the intent and acceptance check, then stop. Write a plan file anyway when the caller (for example `idea-to-pr`) needs one. |
| Standard | Default. | The plan document, sections below. |
| Large | Product intent ambiguous, or the change crosses components, services, or stores. | The same document, with a fuller **Approach**. Never a second document. |

### 2. Discover

Read the code, docs, and prior plans that bear on the request. Run real probes where an assumption could fail: call the API, query the data, run the command, open the file. Record each verified fact with its path or command. Mark each unverified claim as an assumption. Do not summarize files that the builder can read.

### 3. Ask once

List every decision the request leaves open that discovery cannot settle. Ask only when the answer would change user-visible behaviour, data or contract shape, scope, cost, or security or compliance, and reversing it later would be expensive. Never ask about facts the code answers, or about implementation method, stack, or task order; decide those and record them as assumptions.

Rank by impact times uncertainty. Ask the top five to eight in one batch. For each: the question, 2 to 4 options, a recommended option, and one line on why it matters. Add one question on how the user will know the work succeeded, unless it is already clear. Before sending, run a short pre-mortem: assume the effort failed in production and ask what the missing decision was. Use the answer to add questions that discovery would not surface (empty and error states, existing data, who else is affected, what happens to what already exists).

Stop and wait for answers. Run a second round only when an answer opens a new product branch. Write each answer into the plan as a dated decision. Apply every unanswered item's recommended option as an assumption and label it.

### 4. Write the plan

Resolve the plan location with the Plan Location rules, then write one file with these sections, in this order. Omit a section only when it has nothing to say.

- **Outcome**: who benefits and what changes for them, in a few sentences.
- **Acceptance**: observable checks written as behaviour (Given / When / Then, or a command and its expected result). This is the definition of done for the build and the review.
- **Decisions**: settled choices, each dated with its reason and the rejected alternative. Include the user's answers. Update a decision in place when it reverses, and note the reversal.
- **Assumptions**: choices made without asking. The user can veto any of them.
- **Evidence**: verified facts and probe results, each with a path or command.
- **Approach**: the shape of the solution in prose. Name only interfaces, data shapes, and contracts that cross a boundary or that others depend on. Large size: add components, data flow, rollout, and migration here. Add a short order of work only when the sequence is not obvious.
- **Risks and unknowns**: what could fail, how the builder will detect it, and what to do.
- **Out of scope**: what a reader might assume is included and is not.
- **Open questions**: anything unresolved. Must be empty, or each item explicitly deferred with an owner, before build starts.

State each fact once. Do not restate a decision in another section. Put shared conventions in one place and reference them. Leave out file paths and line numbers unless one is a verified fact in Evidence. Leave out signatures, DDL, CSS classes, and test names that the builder can derive.

### 5. Gate

Check the plan: every Acceptance item is observable, every decision has a reason, no Open question blocks build, and nothing is stated twice. Stop and present the plan for review, or return it to an authorized caller. The reviewer checks decisions, acceptance, and risks, not wording.

## Plan Location

The repository owns where plans live and whether they are committed.

1. Use the location and policy that `AGENTS.md` or `CLAUDE.md` document, and obey any rule about committing, ignoring, or deleting plans. A `README` may suggest a location but never authorizes committing, ignoring, or deleting; those need an instruction file or the user.
2. Otherwise use the directory where this repository already keeps plans (`docs/plans/`, `plans/`, `.plans/`, `.agents/plans/`, or similar).
3. Otherwise use `docs/plans/` and record that choice as an assumption.

Name the file `<slug>.md` with a short kebab-case slug, prefixed with a date when the directory already uses dates. Put raw evidence that is too large for the Evidence section next to it in a folder with the same slug. Never edit ignore rules or commit the plan unless the repository policy or the user says to. Report the path and whether git tracks it.

## Revising

When the request changes, a decision reverses, or the build disproves a claim, edit the same document: update Decisions with the date and reason, fix the affected sections, and keep one version. Do not create a second plan, a changelog file, or a status index.

## Safety Rules

- Never edit source, tests, configuration, or dependencies.
- Never invoke an implementation workflow.
- Never ask about facts the code can answer.
- Never ask more than once for the same decision, or finalize while an Open question blocks the build.
- Never record an unverified claim as fact.
- Never create more than one plan document per effort.
- Never assume the user's approval.

## Output Style

Lead with the plan path and whether it is tracked (or `inline` for a trivial effort). Then give the size and why, the decisions asked and how they were answered, the assumptions the user can veto, and the top risks. Name one optional next skill, or none. Wait for explicit approval.
