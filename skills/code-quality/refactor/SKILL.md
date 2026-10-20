---
name: refactor
description: Reviews and fixes code smells, design principles, maintainability, over-engineering. Use when exhaustive review, simplification, extraction, or refactor planning should lead to behavior-preserving fixes. Diagnosis only with --report.
user-invocable: true
disable-model-invocation: false
argument-hint: "[simplify|extract|principles|smells] [scope] [--report]"
---

# Refactor

## Core Contract

Bare `/refactor` exhaustively reviews all four goals and applies supported behavior-preserving fixes within scope; it is not a menu, diff-only review, shallow smell scan, or mandate to apply all 66 techniques. A selected goal narrows only the primary review; `--report` keeps that coverage but diagnoses and proposes only—never edit target source or invoke follow-on implementation.

A slash invocation or explicit request to review and fix authorizes justified fixes without another approval cycle. Loading, quoting, discussion, or review-only requests do not. External callers retain stricter permissions; root mode cannot expand them. Follow `CLAUDE.md` / `AGENTS.md`; references are internal methods, not commands.

## Required Inputs

1. Optional goal and explicit scope/constraints.
2. Mode: direct invocation fixes unless `--report` or caller constraints require report.
3. Existing source-matched findings and a permitted report/artifact path, if requested.

## Workflow

1. **Resolve arguments and authority before work.** Remove `--report` wherever it appears; it changes mutation permission, not coverage. Accept at most one goal (`simplify`, `extract`, `principles`, `smells`) before one optional scope. Remaining non-flag tokens are scope only when they resolve to existing explicit path(s), nonempty matching glob(s), or an expressly recognized diff/PR scope. Reject, before analysis or edits, a second goal, a goal after scope, invalid/unmatched scope, or any unrecognized token; never reinterpret it or fall through into bare exhaustive auto-fix. Unknown options and old selectors (`inspect`, `plan`, `dry`, `srp`, `deep-review`, `lite`, `full`, `ultra`, `audit`, including depth tokens after `simplify`) also stop with a concise correction. A colliding path must be explicit (`./plan`).
   `/refactor` is bare; `/refactor simplify src` selects a goal; `--report` may appear before or after goal/scope. Reject `/refactor smell`, `/refactor simplfy`, `/refactor simplify extract`, `/refactor src extract`, and `/refactor nonexistent`. These declarative rules guide interpretation; they are not an executable argument parser. Pass the resolved invocation to the shared [execution context](REFERENCE.md#execution-context).
2. **Resolve full scope from evidence.** Explicit scope comes first, subject to repository guidance and exclusions. Otherwise use maintained source, tests, and configuration; exclude generated, vendor, dependency, and build output. Use instructions, manifests, tracked paths, and ownership/layout conventions—do not prompt with a route menu. A bare review never silently becomes the current branch diff; inventory included units/exclusions and keep a coverage ledger across chunks.
3. **Load and review the chosen route.** Bare invocation covers every row across full scope. A selected route loads only its method below and supporting checks it names; do not run every method for every route.

   | Goal | Load now; required coverage |
   | --- | --- |
   | `simplify` | [Simplification](references/simplify.md): needless code, complexity, indirection, and [structural review](references/simplify.md#structural-review). Load its [repository audit](references/simplify.md#repository-audit) only for full-scope review. |
   | `extract` | [Extraction](references/extract.md): the single [DRY](references/extract.md#dry-procedure) and [SRP](references/extract.md#srp-procedure) procedures; require `same file`, `other file`, or `new file`, location, and rationale. |
   | `principles` | [Principles](references/principles.md): all 17 in rank order, evidence, bounded precedence, exceptions, and its unranked quality summary. |
   | `smells` | [Smells](references/smells.md): applicable families, catalog evidence, severity, intentional non-findings, and suitable techniques. |

   Load a principle card, smell detail, or technique detail only when its index/shortlist makes it relevant; never load every card or treat techniques as compulsory transformations. Reuse evidence and stable IDs under [finding reuse](REFERENCE.md#finding-reuse): do not repeat DRY/SRP scans or count one root cause twice; keep independent issues separate. Record route-required coverage, reviewed units, exclusions, and gaps. Unexamined files, categories, or checks mean incomplete coverage—never claim exhaustive completion.
4. **Make findings actionable, then apply or report.** Load [technique selection](references/smells.md#select-techniques) only for smell remedies and [planning](references/smells.md#plan) only to aggregate actionable work; neither is a public command or approval gate. Preserve IDs, evidence, constraints, remedies, confidence, risks, validation, and unresolved findings. In fix mode, make supported behavior-preserving reversible changes; in report mode, propose only. Artifacts require caller permission.
   Baseline and run permitted focused checks; record pre-existing failures. Revert only your own failing changes, preserve user edits/tests, invalidate affected evidence and recheck it, and state verification limits.

## Safety Rules

- Fix findings supported by evidence, not every theoretical violation. Preserve intentional exceptions and avoid compulsory aesthetic cleanup or speculative abstractions.
- Preserve public behavior/contracts and proven correctness, security, compatibility, and product requirements above design ranks. Never weaken safeguards, error handling, accessibility, or the last meaningful tests to shrink code.
- Meaningful API, behavior, or dependency changes, unsafe or ambiguous fixes, secrets, and shared-system effects need explicit authority. Leave them unresolved with evidence rather than guessing. Root fix mode does not grant that authority.
- Never broaden the selected scope or overwrite user edits. Do not suppress material findings because they are numerous; chunk work and disclose what remains.
- Never infer permission to commit, push, approve, post comments, install, or mutate remotes from permission to refactor. Honor stricter caller tool/test/write constraints in every method.
- Keep `scope`, `prep`, `pr`, `risk-review`, and workflow tools external shared utilities; do not absorb their responsibilities.

## Output Style

Lead with fixed/proposed/unresolved counts, selected goal or exhaustive default, mode and authority, resolved scope/exclusions, and coverage completed versus remaining. The root summary comes first; internal-method formats follow as subsections or folded content. Distinguish applied fixes from proposals and justified non-findings/exceptions. Include relevant test/baseline results, pre-existing failures, verification limits, risks, and any requested artifact path. A partial review is incomplete, not exhaustive.
