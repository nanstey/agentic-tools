# Ponytail

Remove needless code and complexity without changing behavior. Favor deletion and existing facilities over new machinery; line count never outranks correctness or maintainability.

## Core Contract

Use the caller's [execution context](../REFERENCE.md#execution-context), which controls mode, authority, scope/exclusions, source identity, coverage, reuse, and validation. The default target is maintained source/tests/config, not the current branch diff: preserve behavior while removing needless code, complexity, and indirection. Follow `CLAUDE.md` / `AGENTS.md`.

The method is adapted from [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) and retains its [MIT license](simplify.LICENSE).

## Workflow

Use the [repository audit](#repository-audit) for full maintained-code scope; use diff mechanics only for explicit branch/diff scope.

1. **Resolve scope identity.** Use the caller's inventory/exclusions. For an explicit branch comparison, identify its base (for example the trusted default branch's merge-base) and keep committed/staged/unstaged changes distinct. No diff does not mean no full-scope work.
2. **Read the scoped code.** Inspect units and trace real call paths. For diff scope, read hunks and surrounding code; for full scope, work through the maintained-file inventory. Reuse matching findings and mark uncovered units.
3. **Climb the ladder per unit.** Record each cut as `<file>:L<line>: <tag> <what>. <replacement>.` using the [cut format](#cut-format). Coordinate duplication/responsibility findings with the single DRY/SRP owners rather than starting another scan.
4. **Apply or propose.** In fix mode, apply justified behavior-preserving cuts, biggest payoff first. In report mode, list proposals and stop. A behavior/API/dependency-changing or ambiguous cut remains unresolved without explicit authority, even in fix mode.
5. **Verify authorized edits only.** Establish baseline where possible; run permitted relevant tests/build/smoke checks. A failing cut is reverted, not patched around; revert only your own change, never user edits. Record pre-existing failures and verification limits.
6. **Report.** Findings applied, proposed, unresolved, coverage gaps, validation, and net line change before versus after when available. With complete scope and nothing to cut, say `Lean already.`; never infer readiness or claim completion for unexamined files.

## The ladder

Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need = delete it. (YAGNI)
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it. Re-implementing what sits a few files over is the most common slop.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** CSS over JS, DB constraint over app code.
5. **Already-installed dependency solves it?** Use it. Remove an unneeded dependency when explicit dependency authority permits; otherwise propose removal.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

Two rungs work → take the higher one and move on.

**Bug fix = root cause, not symptom.** If a scoped unit guards several callers,
one guard in the shared function is the smaller change, and patching only the
named path leaves every sibling caller broken.

## Rules

- Cut unrequested abstractions: interface with one implementation, factory for one product, config for a value that never changes, wrapper that only delegates.
- Cut boilerplate and scaffolding "for later".
- Deletion over addition. Boring over clever. Fewest files possible.
- Two stdlib options, same size? Take the one correct on edge cases. Lazy means less code, not the flimsier algorithm.
- A deliberate simplification with a known ceiling gets a plain comment naming the ceiling and upgrade path (`# Global lock; per-account locks if throughput matters.`).

## Internal depth

There is no public depth selector. Legacy lite/full/ultra mechanics do not set scope or mutation authority: lite denotes reporting, full denotes supported implementation, and ultra's unused-requirement challenges remain proposals that need explicit approval. Never delete requirements because they have no observed caller.
Bare exhaustive review and selected simplify use the required full-scope depth, in either fix or report mode. Do not force a lite-first gate.

## Safety Rules

- Never write the word "ponytail" in code, comments, commit messages, PR titles or descriptions, or review comments. Describe the change itself.
- Never simplify away input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, or anything explicitly requested.
- Never change behavior silently; behavior-changing cuts are proposals.
- Never tighten code outside the caller's resolved scope. A branch-diff restriction applies only when the caller chose that scope.
- Never re-argue after the user insists on the full version — keep it.
- Never strip a hardware calibration knob: a real clock drifts and a real sensor reads off, so the physical world needs tuning a minimal model cannot see.
- Never delete the last runnable check on non-trivial logic (a branch, a loop, a parser, a money/security path); one small test or `assert`-based self-check stays.

## Output

In report mode, show proposed cuts only. In fix mode, distinguish applied cuts from proposals and unresolved work, with coverage and validation per the Report step.
Pattern: `cut: [X] → [Y]. net: -<N> lines.`

## Cut format

One line per finding: `<file>:L<line>: <tag> <what>. <replacement>.` (omit the file for a single-file scope). Tags:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

Examples (not permission to remove real requirements or safeguards; prove behavior equivalence before applying):

- `L12-38: stdlib: 27-line validator class. "@" in email, 1 line, real validation is the confirmation mail.`
- `L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.`
- `repo.py:L88: yagni: AbstractRepository with one implementation. Inline it until a second one exists.`
- `L52-71: delete: retry wrapper around an idempotent local call. Nothing replaces it.`
- `L30-44: shrink: manual loop builds dict. dict(zip(keys, values)), 1 line.`

Include `net: -<N> lines possible` for proposals or the actual net change for applied fixes. Line count is diagnostic, never proof of safety. Nothing to cut with complete coverage: `Lean already.` Report gaps instead of claiming a clean result for unexamined code.
A single smoke test or `assert`-based self-check is the minimum. Never flag it for deletion. Findings posted as review or PR comments never mention "ponytail".

## Repository audit

Apply the cut format across the caller's full resolved maintained-code scope rather than a branch diff. Honor repository exclusions for generated, vendor, dependency, and build output. Inventory and examine units in chunks, and disclose unexamined files and categories. Audit is internal methodology: it grants no authority and does not force report mode.
Rank findings by observed payoff and risk, then cut size. Reuse matching evidence and DRY/SRP findings rather than duplicating passes.

Hunt for: dependencies the stdlib or platform already ships, single-implementation interfaces, factories with one product, wrappers that only delegate, files exporting one thing, dead flags and config, hand-rolled stdlib.

Output one ranked line per finding: `<tag> <what to cut>. <replacement>. [path]`. Distinguish applied, proposed, and unresolved cuts with validation and coverage gaps. Add `net: -<N> lines, -<M> deps possible` where supported. Dependency changes need explicit authority.

Scope is over-engineering and complexity only. Correctness, security, and performance go to a normal review pass. Never weaken safeguards, tests, or requested requirements for a cut. Never report an incomplete inventory as exhaustive.

## Structural review

Run an aggressive maintainability review focused on structural simplification. Include it in bare exhaustive review and simplification. External callers (for example risk-review) may select it alone, in report mode, for structural effects.
Use the caller's scope and source identity. For an explicit diff/PR scope, use the caller's authoritative base/head (or `/pr info` if authorized), tie findings to that comparison, and keep committed and working-tree changes separate. For full scope, inspect current units and call paths without a branch diff. Reuse matching evidence and record unexamined units as coverage gaps.
A read-only caller may also forbid tests and builds. Never expand its permissions. No comments, approval, commits, or pushes are implied.

Priorities:

1. Prefer designs that delete complexity, not move it.
2. Treat new spaghetti branching and ad-hoc flags as design problems.
3. Flag file-size explosions (especially past ~1000 lines) unless justified.
4. Push logic toward the appropriate layer and reuse existing helpers.
5. Prefer explicit type/boundary contracts over cast-heavy or optionality-heavy flow.
6. Call out unnecessary indirection, wrappers, and magic abstractions.
7. Prefer simpler, more atomic orchestration when obvious.

Core questions:

- Is there a clear "code judo" simplification that removes branches, helpers, or layers?
- Is the module easier or harder to reason about?
- Is logic in the right layer with the right abstraction boundary?
- Does the code contain avoidable conditionals, casts, or duplicated logic?
- Is decomposition needed before accepting the current shape?

Lead with the highest-severity structural findings, with concrete evidence and actionable remedies. Prefer a few high-conviction findings over many cosmetic notes. Treat major structural regressions as material findings unless justified. External callers apply their own finding categories and blocking policy. Cover the whole resolved structural scope. Do not use the preference for high-conviction findings to skip units or hide gaps.
