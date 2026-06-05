---
name: smell
description: Run a structured code-smell review that maps findings to standard smell categories and classes, gives short evidence-backed explanations, and reports practical good-vs-bad guidance. The taxonomy is self-contained in this skill so reviews stay consistent without external lookups. Use when reviewing code for maintainability risks, hidden design debt, or refactor priorities.
user-invocable: true
disable-model-invocation: false
---

# Smell

## Core Contract

Use this skill to run a code-smell-first maintainability review. It is designed
for review work, not for writing new feature code.

Default behavior is lightweight but evidence-based: identify the most relevant
smell categories, map concrete findings to specific smell classes, and report a
small ranked checklist with practical remediation guidance.

This skill includes a built-in smell taxonomy and examples so the review remains
self-contained. Adapt that taxonomy to the target repository's language,
architecture, and constraints.

Keep `CLAUDE.md` and `AGENTS.md` in the target repository as authoritative. If
they conflict with this skill, follow those files.

## Required Inputs

Gather or infer:

1. Review scope (`diff`, `directory`, or `subsystem`).
2. Language and framework context for the code under review.
3. Target strictness (`quick high-signal` vs `deeper sweep`).
4. Whether to use only the embedded taxonomy (default) or include additional
   smell classes explicitly supplied by the user.

## Workflow

### 1. Frame the review

1. Confirm what is being reviewed and why (PR gate, cleanup pass, or diagnosis).
2. Identify likely pain type: readability, change-cost, coupling, or bloat.
3. Select 2-4 smell categories to prioritize first.

### 2. Load embedded smell taxonomy

1. Use the category set embedded in this skill: `Bloaters`,
   `Object-Orientation Abusers`, `Change Preventers`, `Dispensables`,
   `Couplers`, and `Other`.
2. Use the class list embedded below as the canonical review checklist.
3. Only add classes not listed here when the user explicitly requests an
   alternate taxonomy.

Stop-and-ask gate: if a candidate finding does not map cleanly to an embedded
class, ask the user before introducing a custom class label.

### 3. Run the smell checklist

Use each smell as: **Class -> Simple explanation -> Apply when -> Good vs bad
signal**.

1. **Bloaters**
   - `Long Method`: method does too much; apply when control flow and side
     effects are dense; good: small composable steps, bad: 100-line
     orchestrators.
   - `Large Class`: class has too many responsibilities; apply when unrelated
     fields/methods grow together; good: cohesive domain object, bad: God class.
   - `Primitive Obsession`: primitives replace domain concepts; apply when
     strings/ints encode rich meaning; good: value objects, bad: ad-hoc parsing
     everywhere.
   - `Long Parameter List`: too many parameters hide missing structure; apply
     when call sites are hard to read; good: cohesive parameter object, bad:
     positional argument chains.
   - `Data Clumps`: variables repeatedly travel together; apply when same field
     bundle appears across methods/classes; good: extracted type, bad:
     copy-pasted tuples.

2. **Object-Orientation Abusers**
   - `Switch Statements`: type/role branching repeats behavior decisions; apply
     when variants are added through branching edits; good: polymorphism/strategy,
     bad: duplicated switch trees.
   - `Temporary Field`: fields used only in narrow scenarios; apply when object
     validity depends on procedural phases; good: extracted collaborator, bad:
     nullable lifecycle flags.
   - `Refused Bequest`: subclass rejects parent contract; apply when inherited
     members are unused or invalid; good: composition or better hierarchy, bad:
     exception-throwing overrides.
   - `Alternative Classes with Different Interfaces`: same job, different APIs;
     apply when adapters are repeatedly needed; good: unified contract, bad:
     semantic duplicates with mismatched names.

3. **Change Preventers**
   - `Divergent Change`: one class changes for many unrelated reasons; apply
     when one feature request touches unrelated methods; good: split by reason
     to change, bad: central edit hotspot.
   - `Shotgun Surgery`: one change requires many tiny edits; apply when same
     tweak propagates broadly; good: localized change surface, bad:
     N-file maintenance tax.
   - `Parallel Inheritance Hierarchies`: subclassing in one hierarchy forces
     matching subclasses elsewhere; apply when "new type" means duplicate
     hierarchy work; good: composable policies, bad: lockstep inheritance trees.

4. **Dispensables**
   - `Comments`: explanatory comments mask unclear code; apply when comments
     restate confusing logic; good: self-explanatory names + focused comments,
     bad: comment-dependent comprehension.
   - `Duplicate Code`: same logic repeated; apply when bug fixes must be
     synchronized manually; good: shared source of truth, bad: drift-prone copies.
   - `Lazy Class`: class does too little to justify itself; apply when it only
     forwards or stores trivial state; good: meaningful abstraction, bad:
     ceremony-only wrapper.
   - `Data Class`: structure without behavior; apply when other classes perform
     all domain logic on its data; good: rich domain methods, bad:
     anemic-model sprawl.
   - `Dead Code`: unreachable or unused code remains; apply when symbols are not
     referenced in active paths; good: clean active surface, bad: misleading
     legacy branches.
   - `Speculative Generality`: abstraction for hypothetical needs; apply when
     extension points have no concrete caller; good: minimal current design, bad:
     unused hooks and knobs.

5. **Couplers (+ Other)**
   - `Feature Envy`: method uses another object's data more than its own; apply
     when behavior "belongs" elsewhere; good: move behavior to data owner, bad:
     outsider-heavy method logic.
   - `Inappropriate Intimacy`: classes depend on each other's internals; apply
     when private details leak across boundaries; good: explicit narrow API,
     bad: friend-like deep coupling.
   - `Message Chains`: long call chains traverse internals; apply when callers
     navigate object graphs directly; good: tell-don't-ask methods, bad:
     `a.b().c().d()` logic.
   - `Middle Man`: class delegates almost everything; apply when abstraction
     adds indirection without value; good: remove/merge unnecessary forwarding,
     bad: pass-through layers.
   - `Incomplete Library Class` (Other): external library lacks needed behavior;
     apply when teams fork or patch around library gaps; good: adapter/extension
     seam, bad: scattered hacks around immutable dependency limits.

### 4. Decide severity and actions

1. Mark each finding as `high`, `medium`, or `low` maintainability risk.
2. For each `high` finding, propose one concrete refactor direction.
3. Record one "non-finding" where similar code is acceptable to avoid overfitting.

Stop-and-ask gate: if remediation requires architecture or scope changes beyond
the requested review, pause and ask before proposing implementation work.

### 5. Verify and report

1. Ensure every finding maps to a specific smell class (avoid vague "code
   quality" labels).
2. Ensure evidence is concrete and tied to reviewed code locations.
3. Keep final report short and prioritized.

## Implementation Notes

- Prefer high-confidence smell labels over broad low-confidence sweeps.
- If several smells apply, choose the primary smell and list secondary smells as
  context.
- Avoid language-specific dogma; map smell intent to the idioms of the current
  codebase.
- In reviews, "good vs bad" should be concrete patterns, not moral judgments.

## Safety Rules

- Never label something a smell without evidence in the actual reviewed code.
- Never demand broad refactors when a localized fix addresses the risk.
- Never force category coverage; report only categories that actually appear.
- Never treat a single reference source as infallible when repository context
  clearly justifies an exception.

## Output Style

When finishing, report:

1. Scope reviewed and categories/classes evaluated.
2. Findings grouped by smell category and class, each with:
   - simple explanation,
   - apply-when rationale,
   - good vs bad signal,
   - short reference.
3. Severity-ranked top actions and one intentional non-finding.
