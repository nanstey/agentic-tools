---
name: principles
description: Evaluate software decisions with a canonical principles hierarchy stored inside this skill by selecting the highest-impact checks, resolving principle conflicts with a foundation-first tie-break rule, and producing evidence-backed recommendations. Use when making architecture choices, writing non-trivial code, or reviewing changes for long-term maintainability.
user-invocable: true
disable-model-invocation: false
---

# Principles

## Core Contract

Use this skill to run a lightweight principles pass before and during design,
implementation, and code review, using canonical principle knowledge in files
that are relative to this skill directory (`skills/code-quality/principles/`):

- `principles/index.json`
- `principles/<category>/<principle-id>.md`

Default behavior is repeatable and evidence-based: frame the decision, select
the highest-impact principles, evaluate pass/fail against concrete context, and
resolve conflicts with a deterministic priority tie-break.

This skill is guidance, not dogma. Prefer pragmatic choices that fit constraints
without accumulating avoidable maintenance cost.

Keep `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. Current task type (`design`, `implement`, or `review`).
2. Scope under change (module, API surface, workflow, or subsystem), confirmed
   via the `scope` skill unless already explicit in the request.
3. Constraints (performance, timeline, compatibility, team conventions).
4. Whether the change is incremental or foundational.
5. Any known principle conflict the team is actively debating.

## Workflow

### 1. Confirm scope

Use the `scope` skill to confirm review boundaries unless the user already
specified them. Keep the scope statement available for the rest of the run.

### 2. Frame the decision

1. State what is being decided, changed, or reviewed.
2. Identify the riskiest failure mode if the design is wrong.
3. Note any likely principle conflicts (for example `yagni` vs `agile-practices`).

### 3. Load canonical principles hierarchy

1. Read `./principles/index.json` (relative to this skill directory, not the
   target repository root).
2. Build candidate principles from `principles[]`, using `aliases` only as lookups.
3. Select 3-5 principles with highest impact for the current decision.
4. For each selected principle, load
   `principles/<category>/<principle-id>.md`.

Stop-and-ask gate: if `principles/index.json` is unavailable, ask before falling
back to an embedded/manual principles list.

### 4. Evaluate selected principles

Use each selected principle file as:
**What it means -> Apply when -> Good vs bad -> Tradeoffs and conflicts**.

For each selected principle:

1. Record pass/fail with one sentence of evidence.
2. If failing intentionally, document reason and guardrail.
3. Propose the smallest viable remediation that does not break lower-priority
   commitments.

### 5. Resolve conflicts with priority tie-break

1. Detect conflicts between selected principles.
2. Compare `priority_level` values from `./principles/index.json`.
3. Prefer the lower number (foundation-first) when principles conflict.
4. Keep a guardrail note for the deferred principle.
5. If conflict resolution changes scope, architecture, or delivery timing, stop
   and ask before proceeding.

### 6. Verify outcomes

1. Confirm readability and testability improved (or did not regress).
2. Confirm abstractions have immediate use, not speculation.
3. Confirm conflict decisions were explicit and defensible.
4. Confirm complexity matches present requirements and constraints.

## Implementation Notes

- Keep the checklist fast: usually 3-5 principles per decision.
- Report canonical IDs from `./principles/index.json`.
- Treat priority number as a tie-break for conflicts, not as a reason to ignore
  relevant higher-level principles.
- During reviews, tie recommendations to concrete code evidence, not generic advice.
- Re-run this skill after major scope or architecture changes.

## Safety Rules

- Never apply principles mechanically when constraints require a pragmatic exception.
- Never add speculative abstractions solely to satisfy a principle.
- Never report "best practice" claims without concrete context.
- Never invent non-canonical principle IDs/labels without explicit user approval.
- Never force broad refactors without user approval when localized fixes are sufficient.

## Output Style

Use this fixed five-section layout:

### 1) Review Frame

- `Type:` one of `design`, `implement`, `review`
- `Scope used:` final confirmed scope
- `Why this scope:` one short sentence

### 2) Principle Outcomes

Then list 3-5 canonical IDs in priority-aware order:

- ``<emoji> `<principle-id>`: <short verdict + concrete evidence>``

Keep each line concrete and scope-bound. Avoid generic best-practice language.

### 3) Priority Conflict Log

- `Detected:` each conflict pair (or `None`)
- `Resolution:` winner principle with tie-break reason from `priority_level`
- `Deferred principle guardrail:` one concrete safeguard

### 4) Accepted Exceptions

- List intentional violations with rationale and guardrail.
- If none, write `None identified`.

### 5) Action Queue

- Ordered, highest impact first.
- Prefer smallest low-risk changes before broad refactors.
- Add rerun guidance when later deltas are required.

## Output Examples

### Example: Review doc architecture flow

#### 1) Review Frame
- Type: `review`
- Scope used: current branch diff against base (`base...HEAD`)
- Why this scope: `/principles` was invoked without explicit boundaries, so current-branch default applies.

#### 2) Principle Outcomes
- ✅ `make-it-work`: Implemented behavior is explicit, and future items are separated (`Not Yet Implemented` isolates deferred work).
- ✅ `yagni`: No speculative commitments; cart bootstrap, mutation endpoints, and rolling expiry refresh stay deferred.
- ⚠️ `be-consistent`: Mostly consistent structure, with one clarity defect (`active grant grant`).
- ✅ `separation-of-concerns`: Session, grant, and exchange responsibilities remain clearly partitioned.

#### 3) Priority Conflict Log
- Detected: `make-it-work` vs `separation-of-concerns`
- Resolution: prioritize `make-it-work` by lower `priority_level`
- Deferred principle guardrail: keep concern boundaries explicit in docs and contracts

#### 4) Accepted Exceptions
- None identified.

#### 5) Action Queue
1. Fix duplicated wording in `docs/architecture/public-access-flows.md`.
2. Add a short `Security invariants` subsection for audit speed.
3. Re-run `/principles` on branch diff after code lands.
