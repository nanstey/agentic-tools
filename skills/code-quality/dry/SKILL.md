---
name: dry
description: Hunt for code duplication, DRY violations, and simplification opportunities across a chosen scope, then report ranked findings — including proposals for new small, focused files or helpers that consolidate repeated logic. Distinguishes true duplication worth extracting from incidental similarity that should stay separate. Read-only: it never edits. Use when the user wants to find duplicated code, DRY up a codebase, surface reuse opportunities, or identify logic worth extracting into shared helpers or files.
---

# Dry

## Core Contract

Use this skill when the user wants to find code duplication, DRY violations, and simplification opportunities, and get concrete proposals for consolidating them — including extracting new small reusable files. It hunts for *reuse*, not bugs; for correctness review use `code-review`, for broad structural maintainability use `deep-review`.

This skill is **read-only**. It inspects, ranks, and proposes — it never edits, creates, stages, or commits anything. When the user picks findings to act on, hand off to `simplify` or implement the change directly in a normal (non-skill) turn.

Judgment is the point. Not all repetition is duplication worth removing. Surface the duplication that represents a single concept expressed many times; leave alone code that merely looks similar today but answers to different reasons to change. Over-eager DRYing that couples unrelated code is a worse outcome than the duplication it removes — call that out too.

Keep `CLAUDE.md` and `AGENTS.md` in the target repo as the source of truth. If they define module layout, naming, or "where shared code goes" conventions, follow them over this skill's defaults.

## Required Inputs

Before scanning, settle:

1. **Scope** — always confirm at the start of a run via the `scope` skill. If
   the user already named a scope in their request, confirm it and proceed
   without re-asking.
2. **Languages / file types** in scope, so detection ignores generated code, vendored dependencies, lockfiles, and build output.
3. **Appetite** — a quick high-signal pass (top few opportunities) vs. an exhaustive sweep. Default: high-signal, ranked, with a clear bottom line.

## Workflow

### 1. Confirm scope

Use the `scope` skill to confirm the scan scope unless the user already
specified it. Establish the repo's existing conventions for shared code: look
for `lib/`, `utils/`, `common/`, `shared/`, `helpers/`, or equivalent, and note
the prevailing module/file naming style so proposals fit in.

### 2. Gather the candidate set

- Diff scope: `git diff` / `git diff --staged` / `git diff <base>...HEAD` to get changed hunks; read the surrounding files for context.
- Directory / repo scope: enumerate source files, excluding generated, vendored, and build artifacts. Lead with a structural skim (file list, sizes) before reading bodies.
- Do not rely on a single search angle. Look for duplication by multiple signals (see Implementation Notes).

### 3. Classify each repetition

For every cluster of similar code, decide which bucket it falls in:

- **True duplication** — the same logic/decision expressed in multiple places; one source of truth would be clearer and changes would otherwise have to be made in lockstep. *Candidate for extraction.*
- **Incidental similarity** — code that looks alike now but exists for independent reasons and would diverge under different pressures. *Leave separate; merging it would create false coupling.*
- **Near-duplication** — mostly-shared logic with small real differences. *Candidate, but the differences must be modeled honestly (parameter, strategy, or small variant) rather than smuggled in via flags.*

Only true and well-modeled near-duplication become findings. Explicitly note where you chose *not* to merge and why, so the user trusts the ones you did flag.

### 4. Design the consolidation

For each finding, propose the concrete shape of the fix:

- **Extract a helper / pure function** within an existing module when the logic is small and belongs to that module's concern.
- **Create a new small focused file** when the shared concept doesn't belong to any current file — name it for the concept, place it per repo convention, and keep it narrow (one cohesive responsibility, not a junk-drawer `utils.js`). Say exactly what would move into it and which call sites would import it.
- **Reuse an existing canonical helper** when one already exists and the duplication is reinventing it — prefer this over creating anything new.
- **Collapse repeated conditionals / parallel structures** into a single data-driven flow, table, or dispatch when branches differ only by values.
- **Hoist repeated literals / config** into named constants.

Prefer the smallest change that removes the duplication without over-abstracting. A new file must earn its keep — if a one-line helper in place is clearer than a new module, say so.

### 5. Rank and report

Order findings by payoff: high duplication count × high change-risk-if-not-unified × low extraction cost first. For each finding give: what is duplicated, every `file:line` it appears at, the proposed consolidation, the new file/helper name and location, and a one-line rationale. End with a bottom line and offer `simplify` (or a direct implementation turn) as the next step.

## Implementation Notes

- **Detection signals** (use several, they catch different duplication):
  - Copy-paste blocks — near-identical statement sequences across files or functions.
  - Repeated conditional ladders or `switch`/`if` chains keyed on the same thing.
  - Parallel structures — N functions/types/objects that differ only in a value or name.
  - Repeated string/number literals, magic values, and inline config.
  - Re-implemented standard operations the language/stdlib or an existing repo helper already provides.
  - Duplicated type/interface/schema shapes describing the same data.
- Useful commands: `git grep -n` for literal/identifier recurrence, `grep -rn`, `git diff --stat` to scope a diff, file-size listing to spot sprawl worth splitting.
- Exclude from scanning: generated files, `node_modules`/vendored deps, lockfiles, minified bundles, snapshots, and anything `.gitignore`d.
- Respect language idioms: what counts as "reusable" and where shared code lives differs per ecosystem — match the repo, don't impose a foreign layout.
- For large scopes, sample and report representative clusters rather than exhaustively listing every two-line echo; note that you sampled and what was left out.

## Safety Rules

- Never edit, create, move, stage, or commit files. This skill only reads and reports. Proposing a new file is a *proposal*, not an action.
- Do not recommend merging code that merely looks similar — false coupling is a regression. When in doubt, leave it separate and say why.
- Do not propose a sprawling catch-all `utils`/`helpers` file. New files must be narrow and named for a single concept.
- Do not over-index on tiny repetitions (a duplicated two-line idiom used twice) when larger consolidations exist — prefer a few high-conviction findings over a flood of nits.
- Apply the rule of three as a guide, not a law: two occurrences can justify extraction when both must change together, and three near-copies can be fine if they're genuinely independent.

## Output Style

When finishing, report:

1. The scope scanned and what was excluded.
2. Ranked findings — each with: the duplicated concept, all `file:line` occurrences, the proposed consolidation (helper vs. new file vs. reuse-existing), the new file/helper name and location, and a one-line rationale.
3. Deliberate non-findings — notable similarities you chose to leave separate, with the reason, so the user can trust the judgment.
4. A bottom line: the highest-payoff consolidation to do first, and an offer to hand off to `simplify` or implement it directly.
