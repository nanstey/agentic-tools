---
name: principles
description: Remind the agent to apply software development best practices while designing, implementing, and reviewing code by running a short principles checklist with practical usage guidance and contrastive references. Use when making architecture choices, writing non-trivial code, or reviewing changes for long-term maintainability.
user-invocable: true
disable-model-invocation: false
---

# Principles

## Core Contract

Use this skill to run a quick, practical best-practices pass before and during
design, implementation, and code review.

Default behavior is lightweight and repeatable: identify the decision at hand,
check the most relevant principles, call out trade-offs, and adjust the plan or
code before proceeding.

This skill is guidance, not dogma. Prefer pragmatic choices that fit current
constraints while avoiding avoidable long-term maintenance cost.

Keep `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. Current task type (`design`, `implement`, or `review`).
2. Scope under change (module, API surface, workflow, or subsystem).
3. Constraints (performance, timeline, compatibility, team conventions).
4. Whether the change is incremental or foundational.

## Workflow

### 1. Frame the decision

1. State what is being decided, changed, or reviewed.
2. Identify the riskiest failure mode if the design is wrong.
3. Select 3-5 principles from the checklist that most affect this decision.

### 2. Run the principles checklist

Use each item as: **What it means -> Apply when -> Good vs bad references**.

1. **Single Responsibility (SRP)**
   - Means: one unit of code should have one primary reason to change.
   - Apply when: a file/class/function accumulates unrelated branches or duties.
   - Good example: small focused units in Martin's SRP examples.
   - Bad example: "God object" classes handling validation, persistence, and UI flow.
   - References: Robert C. Martin, *Agile Software Development (SOLID)*.

2. **Open/Closed Principle (OCP)**
   - Means: extend behavior without editing stable, shared code paths.
   - Apply when: adding variants/features repeatedly changes the same core branch.
   - Good example: strategy/policy objects for feature variation.
   - Bad example: growing `if/else` or `switch` chains in core orchestration logic.
   - References: Bertrand Meyer, *Object-Oriented Software Construction*.

3. **DRY (Don't Repeat Yourself)**
   - Means: keep shared logic and knowledge in one authoritative place.
   - Apply when: similar logic appears in multiple files with synchronized edits.
   - Good example: extracted reusable function/module with clear ownership.
   - Bad example: copy-pasted business rules that drift over time.
   - References: Hunt & Thomas, *The Pragmatic Programmer*.

4. **KISS (Keep It Simple, Stupid)**
   - Means: prefer the simplest design that correctly solves current scope.
   - Apply when: introducing abstractions, frameworks, or generalized workflows.
   - Good example: direct, readable implementation with minimal moving parts.
   - Bad example: speculative architecture for hypothetical future requirements.
   - References: Kelly Johnson design maxim; widely adopted engineering practice.

5. **YAGNI (You Aren't Gonna Need It)**
   - Means: do not build capability before there is a real requirement.
   - Apply when: discussing "future-proofing" with no concrete near-term need.
   - Good example: implement today's required behavior with extension seams.
   - Bad example: partially built plugin systems never exercised by production use.
   - References: Beck, *Extreme Programming Explained*.

6. **Composition over Inheritance**
   - Means: prefer assembling behavior from components over deep hierarchies.
   - Apply when: subclass trees become brittle or hard to reason about.
   - Good example: composing small services/policies through interfaces.
   - Bad example: fragile base class and multi-level inheritance surprises.
   - References: Gamma et al., *Design Patterns*.

7. **Separation of Concerns**
   - Means: isolate domain logic, IO, transport, and presentation boundaries.
   - Apply when: tests are hard to write or business rules depend on framework glue.
   - Good example: pure domain logic with adapters for side effects.
   - Bad example: business rules embedded directly in controllers/handlers/views.
   - References: Parnas on modular decomposition; Clean/Hexagonal architecture.

### 3. Decide and adapt

1. For each selected principle, record pass/fail with one sentence of evidence.
2. If one principle is violated intentionally, document why and the guardrail.
3. Update design/code/review comments to resolve clear violations.

Stop-and-ask gate: if fixing a violation requires changing scope, architecture,
or delivery timing, pause and ask the user before proceeding.

### 4. Verify outcomes

1. Confirm readability and testability improved (or did not regress).
2. Confirm new abstractions have immediate use, not speculation.
3. Confirm complexity matches present requirements and constraints.

## Implementation Notes

- Keep the checklist fast: focus on principles with highest impact for the current decision.
- During reviews, use principle language tied to concrete code evidence instead of generic advice.
- If multiple principles conflict, prefer explicit trade-off notes over silent compromises.
- Re-run this skill after major scope or architecture changes.

## Safety Rules

- Never apply principles mechanically when constraints require a pragmatic exception.
- Never add speculative abstractions solely to satisfy a principle.
- Never report "best practice" claims without concrete context from the current code/task.
- Never force broad refactors without user approval when localized fixes are sufficient.

## Output Style

When finishing, report:

1. Task type and scope reviewed.
2. Principles applied (3-5 items) and pass/fail evidence for each.
3. Trade-offs or intentional violations and why they are acceptable.
4. Concrete follow-up actions (if any), ordered by impact.
