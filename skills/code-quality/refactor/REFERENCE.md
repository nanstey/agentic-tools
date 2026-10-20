# Refactor Reference

## Purpose and path anchors

[SKILL.md](SKILL.md) is the sole entrypoint. Its internal methods retain smell diagnosis,
technique ranking, extraction placement, duplication/responsibility review, ordered
principles review, strict structural review, and simplification/audit guidance.

All `./` dataset paths in this document resolve against this file's directory
(`refactor/`), not the target repository or a former specialist directory.
Method links and code paths resolve against each method file unless stated otherwise.
Every index `path` value resolves against the directory containing that index.
References mirror the goals. Each goal has one method file. Dataset directories hold data only.

| Goal | Method file | Datasets |
| --- | --- | --- |
| `simplify` | `references/simplify.md` (ladder, cut format, audit, structural review, `LICENSE`) | none |
| `extract` | `references/extract.md` (extraction placement, DRY and SRP procedures) | none |
| `principles` | `references/principles.md` (ranked review, quality summary) | `references/principles/` |
| `smells` | `references/smells.md` (diagnosis, technique selection, planning) | `references/smells/`, `references/techniques/`, `references/technique-map/` |

No dataset directory remains at the skill root.

The [technique-selection stage](references/smells.md#select-techniques) chooses which technique fits each smell.
The [planning stage](references/smells.md#plan) aggregates actionable recommendations for the caller's fix or report mode.

## Execution context

The root resolves arguments, scope, and authority before dispatch. Every internal method receives goal, `mode: fix|report`, resolved scope/exclusions, immutable source identity (including working-tree content), required coverage/depth, existing findings, and caller constraints. Missing mutation authority means report mode; loading a method or this reference never authorizes edits.

- A slash invocation or an explicit user request to review and fix defaults to fix mode. Mere model or skill loading, quoting, discussion, or a review-only request does not. Bare invocation requires exhaustive coverage across simplification/structural review, extraction with DRY/SRP placement, all 17 ordered principles, and applicable smell families. A selected goal narrows primary coverage, not rigor within that goal.
- `--report` keeps identical chosen coverage, with no target source edits or follow-on implementation. Report artifacts require caller permission. External source reviewers such as risk-review remain report-only and may also forbid tests/builds and artifact writes; the root default cannot expand those permissions.
- Methods diagnose and prepare remedies under this context. In fix mode, return actionable recommendations to the root/caller for supported behavior-preserving implementation and validation, or apply within that same authority if delegated. A method's report format is not a mandatory report/approve cycle. Technique selection and planning are internal stages, not separate public commands.
- In report mode, all implementation imperatives are proposals only; stop after reporting. No method may invoke an implementation step or promote itself to fix mode.
- Repository guidance, explicit scope, preserved behavior/contracts, user edits/tests, intentional exceptions, and correctness/security/compatibility/product obligations constrain every method. Meaningful API/behavior/dependency changes, unsafe or ambiguous fixes, secrets, and shared systems remain unresolved without explicit authority.
- Establish baseline checks where possible and permitted. Use focused reversible changes, relevant tests, affected-coverage reassessment, and revert only your own failing changes. Record pre-existing failures and verification limits. Never imply commits, pushes, approval, comments, installation, or remote actions are authorized.
- Track files/units and required checks across chunks. Unexamined files/categories and unavailable evidence are coverage gaps, never a complete/exhaustive result. Reuse the shared finding rule below rather than duplicating passes.
- The root output summary comes first. Method-specific required formats follow as subsections or folded content, so their Scope/Report/Details layouts add detail without replacing root counts, goal, mode, scope, or coverage.

## Dataset layout and schemas

### Smells

[references/smells/index.json](references/smells/index.json) contains `meta.version`, `meta.source`, category
grouping, and `smells[]`: `id`, `name`, `category_id`, `path`, `related_refactorings[]`.
Its 23 detail files at `./references/smells/<category>/<smell-id>.md` cover signs/symptoms,
reasons, treatment techniques, payoff/performance notes, and related refactorings.

Categories: `bloaters`, `object-orientation-abusers`, `change-preventers`,
`dispensables`, and `couplers`.

### Techniques and relationship graph

[references/techniques/index.json](references/techniques/index.json) contains compact technique IDs, names,
family IDs, URLs, and family membership. Resolve detail files by
`./references/techniques/<family_id>/<technique-id>.md` (66 files). The
[technique-selection stage](references/smells.md#select-techniques) must load top-candidate details for
tradeoffs and implementation guidance; metadata alone reduces confidence.

[references/technique-map/smell-to-technique.json](references/technique-map/smell-to-technique.json) contains:

- `meta`: `generated_at`, `generator`, `source_root`, `source_pages`, `maintenance_mode`.
- `families[]`: `id`, `name`, `url`, `description`, `technique_ids[]`.
- `techniques[]`: `id`, `name`, `url`, `family_id`.
- `smells[]`: `id`, `name` (the preserved graph has no smell nodes; the smell index supplies the smell-to-technique shortlist).
- `edges[]`: `from`, `to`, `type`, `source_url`. Types are `belongs_to_family`,
  `anti_refactoring`, `similar_refactoring`, `helps_refactoring`, `eliminates_smell`.

Use each smell's `related_refactorings` to shortlist candidates, then graph edges
for relationships/sequencing and technique details for final ranking.

### Principles

[references/principles/index.json](references/principles/index.json) contains:

- `meta`: `version`, `source`, `notes`.
- `categories[]`: `id`, `name`, `principles[]` (`id`, `name`, `path`).
- `principles[]`: `id`, `name`, `category_id`, `path`, `source_url`,
  `priority_level`, `related_principles[]`, `aliases[]`.

The 17 ranked cards use `./references/principles/<group>/<NN>-<principle-id>.md`.
`NN` is the unique two-digit `priority_level`, from 01 through 17 without ties.
The three groups are `1-high` (ranks 1–4), `2-med` (5–13), and `3-low` (14–17).
Index categories and card category metadata use these groups. No topical grouping remains.
Cards contain meaning, application guidance, good/bad examples, conflicts/tradeoffs, and references.
Evaluate the full `principles[]` array in its stored rank order.
The [quality summary](references/principles.md#quality-summary) retains Clean Code guidance as an unranked aggregate of completed findings.
It adds no review pass, ranked result, finding, method, or route.

### Default precedence

Lower numbers win design trade-offs by default. This order never overrides correctness, security, compatibility, or explicit product requirements.
Contextual exceptions must cite concrete evidence and guardrails. Keep all material findings, including requests from higher-numbered principles.
A lower-numbered concern can constrain a remedy. It cannot dismiss a verified request from a higher-numbered principle.
For example, preserve cohesion before DRY. False coupling is not worth deduplication.
Open/Closed does not justify speculative abstractions. Card-specific trade-off guidance follows this bounded rule.

## Validation and fast path

Planning accepts actionable findings with stable recognized finding IDs, concrete evidence locations,
constraints, remedies, risks, and validation steps. Only smell-ID findings may use technique selection:
direct technique inputs for them must supply a recognized smell ID and explicit recognized technique IDs.
Validate smell entries, local ID alignment, and relationship consistency before accepting direct
recommendations. Reject unknown or underspecified smell technique entries; use the local technique-selection
method for smell entries that do not pass completely. Non-smell findings retain their own recognized
finding IDs and evidence; they do not require an invented smell ID. Retain evidence, constraints,
primary/fallback recommendations where applicable, rationale, confidence, risks, and unresolved
findings in the final plan.

## Finding reuse

Apply this rule across focused DRY/SRP reviews, principles, extraction, and risk-review callers.

- Retain one stable finding ID for one underlying issue. Attach all applicable principle IDs and method labels to that finding.
- Keep its evidence, severity, improvement value, rationale, and proposed remedy. Preserve all material findings and focused-method depth.
- Do not merge independent issues because they share a location. Compare the root cause and evidence, not file/line alone.
- Reuse findings only when scope, source identity, and check coverage match. Scope includes exclusions. Source identity includes immutable plan/artifact identity or diff base/head and working-tree content identity.
- Check coverage includes the method, reviewed units, and pass depth. A matching source identity alone does not prove coverage.
- If any key differs, reevaluate affected coverage and retain valid unaffected evidence. Update the existing finding instead of counting it again.
- Principles uses the local DRY/SRP procedures only for applicable checks inside its resolved scope. Do not start a broader independent scan.
- For plan-only reviews, assess the supplied artifact with applicable local checks. Do not invent source facts or claim uninspected source coverage.

Principle definition cards provide context, examples, and conflict guidance. They do not define another execution procedure.
The procedures live only in [the DRY](references/extract.md#dry-procedure) and [SRP](references/extract.md#srp-procedure) procedures in `extract.md`.
Principles maps their findings into its full hierarchy and applies [bounded default precedence](#default-precedence) with evidence and exception guardrails.
Count each underlying issue once, even when multiple principle outcomes or extraction recommendations reference it.

## Maintenance

1. Edit the versioned smell, technique, or principle markdown files in place.
2. Update the corresponding index and relationship map together when IDs,
   membership, paths, or relationships change. Preserve stable lowercase-hyphenated IDs.
3. Validate every index path against its index directory, technique detail paths
   against family/ID metadata, related IDs, hierarchy order, and graph endpoints.
4. Preserve strict fast-path validation. Prefer one smell/principle at a time for reviewable diffs.

The JSON `generated_from` and `generator` fields retain historical provenance,
including former specialist paths and an unavailable generator. They are inert
metadata, not runnable commands. There is no supported copy-from-`_knowledge`
refresh or `update-map.py` generator here; maintain the versioned data directly.

## Sources and license

- https://refactoring.guru/refactoring/smells
- Individual smell pages, for example https://refactoring.guru/smells/long-method
- Technique URLs and source pages recorded in the technique index and graph.
- https://medium.com/@bartoszkrajka/principle-of-software-development-principles-f0143d6f405
- Principle baseline definitions and sources recorded in the principles index.
- Simplification method adapted from [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail),
  copyright (c) 2026 DietrichGebert, under the full [MIT license](references/simplify.LICENSE).
