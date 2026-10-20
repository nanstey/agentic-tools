# Refactor encapsulation verification

## Current result (2026-10-20)

All four datasets live under `refactor/references/`: `principles`, `smells`,
`technique-map`, and `techniques`. No dataset directory remains at the skill root.
Principles has 17 unique ranks. High contains 1–4, Medium 5–13, and Low 14–17.
Clean Code guidance remains in the unranked `references/quality-summary.md`.
The current static suite passes 36 tests: ten original, fifteen encapsulation/overlap/rank/summary/alias checks, and eleven public-surface wording/structure checks. These inspect prose/data contracts; they do not execute the redesigned skill, flag rejection, runtime enforcement, or prove agent behavior.
The principles check triggers are `dry` and `srp`. The index resolves `srp` to `single-responsibility` for findings and labels.
Earlier preservation records below are historical where later user decisions change metadata, layout, or triggers.

Refactor is the sole entrypoint for sniff, fresh-air, extract, dry, srp, principles,
deep-review, and ponytail. Their eight original directories and catalog rows are
absent. Seven methods live at `refactor/references/<name>.md`; simplification lives
at `refactor/references/simplify.md` with its two modes and full MIT license.
None has skill frontmatter or a nested `SKILL.md`.

### Authorized internal directory rename (after prior review)

The user authorized only `references/ponytail` → `references/simplify`. Active router,
reference, catalog, and static-test paths now resolve through `simplify`; the public
`simplify` route is unchanged. The four moved files retain their bytes, including the
MIT license SHA-256 `fb1bc6909ac3ef82d5c22106e32ef682b0cff66788fa915fb9b53b15c9d2f3ab`.
All 112 protected paths match the pre-rename manifest after the one allowed license
path remap; the aggregate path/hash digest changes only from
`cb24497f71e95f0bdd3c27658f04f48020572ed6212ec370135e42ac9cca01a9` to
`171813adb99f3cb3afff6d81356e57687fc588c6ffa67da548f213d15d85287b`.
The static suite passes 36 tests after this rename. The earlier independent refactor
review is before this bounded rename; no independent review of the rename is claimed.

The public surface is `[simplify|extract|principles|smells] [scope] [--report]`.
Bare invocation reviews maintained source/tests/config exhaustively across all four goals and applies supported behavior-preserving fixes. Selected goals narrow primary coverage. `--report` keeps identical chosen coverage without target edits or follow-on implementation. Unknown flags/old selectors stop before analysis/edits, never fall through into exhaustive auto-fix.
Structural/deep review and full-scope audit methodology support the default; internal depth mechanics grant no permissions. DRY/SRP remain the only procedure owners, reused across goals with stable finding IDs. Extraction retains destination/location/rationale; planning retains ID validation, confidence, fast-path gates, and unresolved findings. No second selected-cut approval is required for supported fixes already within direct invocation authority.
Every method inherits explicit mode, scope/exclusions, source identity, coverage/depth, evidence, and caller constraints. Missing authority means report mode. Merely loading a method grants no writes. Risk-review and idea-to-pr pass report mode and SOURCE REVIEW MODE constraints; their no-edit/no-test restrictions remain intact.

Risk-review and idea-to-pr link to internal methods. The Jev questions file,
reviewer profile, installer, portable configuration, historical audit evidence,
and proposal/HTML are unchanged. No branch/worktree creation, staging, commit,
push, remote change, global installation, or new live Jev request occurred.
The one-PR workflow default remains unchanged.

## Initial data preservation (historical)

This records the initial copy before the later priority-group change.
Principle paths and category metadata are the explicit exception described below.

Compared every moved dataset file byte-for-byte with fixed pre-edit commit
`615378008972c923d772e138f466285f2f6db84b` using `git ls-tree`/`git show` and
Python byte comparisons. All match: 23 smell markdown, 66 technique markdown,
18 principle markdown and its index. Existing refactor smell/technique indexes
and relationship map match all source duplicates; only duplicate copies are removed.
All index path fields resolve from their index directories. All related IDs,
family membership, technique detail paths, and graph endpoints resolve.
The graph retains six families, 66 techniques, zero smell nodes, and 139 edges;
the 23-entry smell index supplies related-refactoring mappings.

SHA-256 values fixed in the nine migration tests:

| File under refactor | SHA-256 |
| --- | --- |
| `smells/index.json` | `97755556ed54b10a0b4a3200e48ba96046d45977736d01083cd830e99adee505` |
| `techniques/index.json` | `036316bfd6cc2b77aa308955268050527438f7af6e23a6bd57e2db5d7903221e` |
| `technique-map/smell-to-technique.json` | `5f486587d40c229ea6697108f11739f1dc4e86726d90584129148e4d199fed56` |
| `principles/index.json` | `01f9893509e2623b534a00abbea95ff60d544158578e45088a634516727ae452` |
| `references/ponytail/LICENSE` | `fb1bc6909ac3ef82d5c22106e32ef682b0cff66788fa915fb9b53b15c9d2f3ab` |

Detail-tree hashes concatenate each sorted relative Markdown filename, a NUL byte,
and its unchanged content (no index files):

| Tree | Count | SHA-256 |
| --- | --- | --- |
| `smells` | 23 | `1735b9251d79470e8e5f192d5ca4d391d7b27e44d0f6710307c6db7810816ea4` |
| `techniques` | 66 | `43dbb938168496e502a0b14948a10c26529aa66e12df39fc1304afe22b4fd9f9` |
| `principles` | 18 | `1376b1f368a93c13c54ae9a87c8047661b71feaa08f1dadefb519036855a7701` |

Global skill discovery drops from 48 to 40. The catalog removes exactly eight
standalone rows and uses refactor's exact frontmatter description, with MIT
attribution in a separate paragraph. Shared scope/prep/pr/risk-review and
build/idea-to-pr/speclist remain external. No standalone-specialist links remain
in callable skill Markdown; provenance JSON and historical plans intentionally
retain their original names. Consolidated REFERENCE.md describes versioned
in-place maintenance, not absent copy sources or a runnable missing generator.

## Initial encapsulation validation

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: **19 pass**, ten original plus nine `RefactorEncapsulationTests`.
  Checks include method/catalog removal, local links, stable data hashes/counts,
  index paths and IDs, routing/authorization boundaries, extraction/planning
  detail, MIT preservation, and actual installer collection/linking twice into
  a disposable temporary directory. Discovery exposes refactor and separate
  risk-review, with none of the absorbed names. No runtime destination is used.
- `bash -n install.sh && bash install/tests/install.test.sh`: pass; nine offline
  test groups use temporary fixtures and recording CLI stubs.
- `bash harness/pi/tests/package-patches.test.sh`: pass; four temporary-fixture
  scenarios (apply/ok, absent package, upstream mismatch, multi-hunk rollback).
- `git diff --check`: pass.
- Deslop lint over the router, consolidated reference, internal methods/modes,
  plan index and spec: new method prose has no candidates. Three existing
  `harness` noun uses in historical decisions/validation limits are intentional.

## DRY/SRP overlap follow-up (earlier validation)

The byte-preservation results in this section precede the priority-group change below.

Principles maps the existing `dry` and `single-responsibility` IDs to the focused
procedures in `references/dry.md` and `references/srp.md`. These procedures remain
the only execution instructions for their checks. The 18-principle hierarchy,
focused review depth, evidence requirements, and conflict rules remain intact.
All definition cards remain unchanged contextual summaries.

The shared rule in `refactor/REFERENCE.md#finding-reuse` controls finding identity
and reuse across principles, focused reviews, extraction, and risk-review callers.
It requires matching scope, source identity, and check coverage. Changed keys
require affected-coverage reassessment. One underlying issue retains one stable
finding ID across method/principle labels. Independent issues remain separate,
even at the same location. Plan-only reviews use supplied evidence and do not
start a broader source scan.

`PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`
passes **21 tests**, ten original plus eleven encapsulation/overlap checks.
The two added tests resolve the principle-to-procedure mapping against existing
IDs and assert that all five consumers link to one shared finding rule.
They also check procedure ownership, retained depth, reuse conditions, and
single-finding references in the principles report.

The supplied `/tmp/refactor-baseline-manifest.json` is unchanged. All 113 recorded
old-asset-to-current-path SHA-256 comparisons pass, including all 107 dataset
Markdown files. No definition-card edit is necessary.
`git diff --check` and lint over the changed method/reference prose pass.
The earlier offline installer/patch results above remain valid. This follow-up
does not change the installer, its discovery layout, or patch sources.

## Earlier three-group layout (historical, 2026-10-20)

The later unique-rank and dataset-location decisions below supersede this layout and its preservation exceptions.

The user selects three folders, replacing both the original topical grouping and
the intermediate twelve-folder direction. High contains levels 1–4, Medium 5–8,
and Low 9–12. Each filename retains its original two-digit priority prefix.
Review follows the original flat index order, including ties, not filename sorting.
The shared DRY/SRP procedures and finding-reuse rule remain unchanged.

Paths below are relative to `refactor/principles/`:

| Principle ID | Current path |
| --- | --- |
| `make-it-work` | `1-high/01-make-it-work.md` |
| `yagni` | `1-high/02-yagni.md` |
| `principle-of-least-surprise` | `1-high/03-principle-of-least-surprise.md` |
| `kiss` | `1-high/04-kiss.md` |
| `be-consistent` | `2-med/05-be-consistent.md` |
| `dry` | `2-med/06-dry.md` |
| `clean-code` | `2-med/07-clean-code.md` |
| `separation-of-concerns` | `2-med/07-separation-of-concerns.md` |
| `single-responsibility` | `2-med/08-single-responsibility.md` |
| `open-closed` | `2-med/08-open-closed.md` |
| `liskov-substitution` | `2-med/08-liskov-substitution.md` |
| `interface-segregation` | `2-med/08-interface-segregation.md` |
| `dependency-inversion` | `2-med/08-dependency-inversion.md` |
| `composition-over-inheritance` | `2-med/08-composition-over-inheritance.md` |
| `design-patterns-if-necessary` | `3-low/09-design-patterns-if-necessary.md` |
| `agile-practices` | `3-low/10-agile-practices.md` |
| `boy-scout-rule` | `3-low/11-boy-scout-rule.md` |
| `make-it-fast` | `3-low/12-make-it-fast.md` |

Only category/category_id frontmatter lines change in the 18 cards.
The index replaces category groups and updates path/category_id values.
All 18 flat records retain their IDs, priorities, names, related IDs, aliases,
source URLs, and order. Card prose and all other frontmatter remain unchanged.
No old topical folders, intermediate priority folders, or empty directories remain.

Two fixed baseline digests replace the old exact principle index/tree hashes:

- Flat record digest: `986d5af408f1123876a32fc2daf73c3c219b0d5c4425d360782ae5b4d9b55c45`.
  Serialize the ordered flat record list with sorted keys and compact JSON,
  excluding only `path` and `category_id` from each record.
- Card digest: `9134d8b215c96debe62abd5a891ce146fedc4d106b2343c605b42659ba30d687`.
  Sort by unchanged ID, then concatenate ID, NUL, and card bytes after removing
  only category/category_id frontmatter lines. Keep the remaining bytes unchanged.
- Current principle index SHA-256: `9eb2146f4a21148255fde6ae2de96345ef5d8312c39e749266ab0e5669316d36`.

These digests derive once from fixed pre-edit commit `6153780`.
The tests use constants and do not depend on current Git history or HEAD.
The independent supplied 18-record baseline matches all normalized records and
card hashes. The original 113-entry manifest remains unchanged. Its 94
non-principle entries still match exact bytes. Its 18 principle cards match
normalized baseline bytes at their new paths. The principle index has the
intentional grouping/path changes above, not a claimed exact-byte match.
Both supplied baseline files remain unchanged.

Checks at that earlier layout:

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: **23 pass**.
  Ten original and thirteen encapsulation/overlap/priority tests cover exact
  three-folder membership, metadata/path agreement, preserved IDs/order/ties,
  normalized prose, and all prior routing, reuse, license, and discovery guards.
- `bash -n install.sh && bash install/tests/install.test.sh`: pass in offline temporary fixtures.
- `bash harness/pi/tests/package-patches.test.sh`: pass in temporary fixtures.
- `git diff --check`: pass. Method/reference prose lint has no candidates.

## Current unique ranks and reference datasets (2026-10-20)

The user approves this exact hierarchy, with no tied ranks. Paths below resolve
against `refactor/references/principles/`, not the skill root:

| Rank | Principle ID | Current path |
| --- | --- | --- |
| 1 | `make-it-work` | `1-high/01-make-it-work.md` |
| 2 | `yagni` | `1-high/02-yagni.md` |
| 3 | `principle-of-least-surprise` | `1-high/03-principle-of-least-surprise.md` |
| 4 | `kiss` | `1-high/04-kiss.md` |
| 5 | `liskov-substitution` | `2-med/05-liskov-substitution.md` |
| 6 | `separation-of-concerns` | `2-med/06-separation-of-concerns.md` |
| 7 | `single-responsibility` | `2-med/07-single-responsibility.md` |
| 8 | `interface-segregation` | `2-med/08-interface-segregation.md` |
| 9 | `dependency-inversion` | `2-med/09-dependency-inversion.md` |
| 10 | `be-consistent` | `2-med/10-be-consistent.md` |
| 11 | `composition-over-inheritance` | `2-med/11-composition-over-inheritance.md` |
| 12 | `dry` | `2-med/12-dry.md` |
| 13 | `open-closed` | `2-med/13-open-closed.md` |
| 14 | `design-patterns-if-necessary` | `3-low/14-design-patterns-if-necessary.md` |
| 15 | `agile-practices` | `3-low/15-agile-practices.md` |
| 16 | `boy-scout-rule` | `3-low/16-boy-scout-rule.md` |
| 17 | `make-it-fast` | `3-low/17-make-it-fast.md` |

Lower numbers provide default design trade-off precedence. They never override
correctness, security, compatibility, or explicit product requirements.
Exceptions need concrete evidence and guardrails. Lower-ranked material findings
remain visible. Cohesion takes precedence over false DRY coupling. Open/Closed
does not justify speculative abstractions.

The summary retains useful Clean Code meaning, naming/decomposition guidance,
correctness/readability trade-offs, and original references. It connects cohesion,
clarity, and testability to completed diagnostics and existing finding IDs.
The old independent playbook becomes summary guidance, with no compulsory
readability improvement, extra review pass, ranked status, finding, method, or route.
The principles method places one short unranked summary in its existing Scope section.

### Current preservation exceptions and proof

- Retain all 17 remaining IDs, names, aliases, source URLs, and related IDs,
  except removal of the obsolete `clean-code` reference from Separation of Concerns.
  The Clean Code record itself is no longer active. No invented related ID replaces it.
- Update rank, order, path, and grouping metadata as approved. No retained principle
  body needs a prose change. Only category/category_id/priority_level frontmatter changes.
- Relocate all four data folders into `references/`. Index path values stay relative
  to their index directories and do not gain a `references/` prefix.
- Preserve exact bytes for all 89 smell/technique cards, their three indexes/map,
  and the full MIT license. Old generator paths remain explicitly inert provenance.
- Keep both supplied baseline files unchanged. Compare the original 113-entry
  manifest through the new references location. Its 94 non-principle entries match
  exact bytes. Its 17 retained principle cards match normalized original bytes.
  The principle index and relocated Clean Code summary have the authorized changes above.

Current permanent preservation checks use fixed pre-edit baseline values, not mutable HEAD:

- Retained metadata digest: `777cfec8b2802c1a3c0d5deca2da49926add9d173c803ef742de3f31231fb16f`.
  Sort retained records by ID, exclude only priority_level/path/category_id,
  and remove only obsolete clean-code related references before deriving the baseline.
  Serialize with sorted keys and compact JSON.
- Retained card digest: `23c7296c76cffab9111bb0c88a7894372d76a97a7bf4c24e09bf52c3286b5c8c`.
  Sort by ID and concatenate ID, NUL, and card bytes, excluding only the three
  authorized frontmatter fields. Body bytes remain exact.
- Current `references/principles/index.json` SHA-256: `1aa30b218abd3d5a9a6aa9a27ad580781fc7c2d749cdb8b232b9f33fc2ff6ca7`.
- Exact expected order, continuous ranks 1–17, three folder ranges, prefixes,
  index membership, card metadata, and related-ID resolution have separate assertions.
- The unranked summary has no obsolete frontmatter or ranked index entry.
  Tests verify its source references, completed-review reuse, and bounded precedence.

### Earlier unique-rank/dataset validation (before the later user edit)

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: **24 pass**.
  Ten original and fourteen encapsulation/overlap/rank/summary checks pass.
  Root dataset absence and reference dataset presence are explicit assertions.
- `bash -n install.sh && bash install/tests/install.test.sh`: pass using offline temporary fixtures.
- `bash harness/pi/tests/package-patches.test.sh`: pass using temporary fixtures.
- `git diff --check`: pass. Method/reference prose lint has no candidates.

## Independent-review corrections and earlier validation (2026-10-20)

Correction to the earlier method-mapping description: the user's check triggers
are `dry` and `srp`. The `srp` alias resolves to index ID `single-responsibility`.
Findings and principle labels use resolved index IDs. The user's padded table
and trigger choice remain intact. Only its misleading header changes to Check trigger.

The earlier 24-test success was valid before that manual edit. Independent review
then observed 23 passes and one failure because the parser required single spaces
and the old trigger. That stale success does not describe the edited tree.

Review requests R1–R5 are addressed:

- R1: the test parser accepts table padding. It resolves index IDs and declared aliases,
  requires the two expected procedure owners, and rejects unknown or ambiguous triggers.
  Added coverage checks zero/multiple spaces, tabs, aliases, index IDs, and collisions.
- R2: current counts and results follow the new full rerun. This correction retains
  the valid historical 19/21/23/24-test events and records the intervening failure.
- R3: the table header names check triggers. Method instructions explain the `srp`
  alias and resolved index IDs without changing the approved principle corpus.
- R4: lower numbers win default design trade-offs. Requests from higher-numbered
  principles remain visible. Correctness/security/compatibility/product exceptions
  and concrete evidence/guardrail requirements remain unchanged.
- R5: skill and catalog descriptions match exactly and name smells, DRY, SRP,
  principles, structural maintainability/deep review, over-engineering/simplification,
  extraction, and refactor planning. The argument hint and router choices do not change
  (superseded by the public-surface redesign below).
- N1: graph metadata documentation includes the existing `maintenance_mode` field.
- N2: no summary edit is needed. The user approved unranked aggregation with no
  extra findings or compulsory aesthetic cleanup. Removing the old mandatory
  readability improvement is intentional, not a lost requirement.

Executed checks before the public-surface redesign (historical):

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: **25 pass**.
  Ten original and fifteen encapsulation/overlap/rank/summary/alias tests pass.
- `bash -n install.sh && bash install/tests/install.test.sh`: pass, nine offline temporary-fixture groups.
- `bash harness/pi/tests/package-patches.test.sh`: pass, four temporary-fixture scenarios.
- `git diff --check`: pass. Changed method/reference prose lint has no candidates.
- The 94 non-principle manifest entries remain byte-identical. The final principle
  index hash remains `1aa30b218abd3d5a9a6aa9a27ad580781fc7c2d749cdb8b232b9f33fc2ff6ca7`.
  Permanent normalized-body checks still prove preservation of all 17 retained cards.

These fixes do not change datasets, ranks, summary content, installed skills,
agent profiles, portable configuration, or installer source. Independent review
must recheck the fixes before its requests can be reported as verified closed.

## Approved public-surface redesign and validation (2026-10-20)

User decision: four optional public goals, `simplify`, `extract`, `principles`, and `smells`; default action fixes findings, with optional `--report`. The user then states: “refactor without any options should be an exhaustive review and automatic fixes”. This supersedes the previous public router/manual selectors, bare-menu-only, manual-deep-only default, report/lite-first, and second selected-cut approval. Historical observations above remain evidence of earlier trees, not current permission policy.

Implemented coverage and authority:

- Bare review covers the resolved maintained source/tests/config, excluding generated/vendor/dependency/build output and repository-declared exclusions. Explicit scope wins; a branch diff is never an implicit default. Normal scope choices use repository evidence without a route menu.
- Bare coverage includes all 17 ranked principles, all applicable smell families, single-owner DRY/SRP and concrete extraction placement, simplification, and structural/deep maintainability. Audit methodology supports full-scope examination. The 66 techniques remain a remedy catalog, not compulsory transformations. Selected goals use matching evidence and only needed supporting methods.
- A shared execution-context section in REFERENCE.md owns mode/scope/source/coverage/caller rules. Each method and simplification mode links to it. This keeps authority consistent without copying DRY/SRP procedures. Missing authority defaults to report, not fix. Diagnosis and planning return to the authorized caller; fix-mode reports are not a second approval gate.
- `--report` before/after scope in bare and selected forms keeps identical chosen coverage and prohibits target edits or follow-on implementation. Unknown flags and unsupported old selectors stop before analysis/edits rather than changing route or authorizing exhaustive fixes. A colliding directory must be an explicit path such as `./plan`.
- Direct invocation authorizes only supported behavior-preserving fixes within scope. Meaningful API/behavior/dependency changes, unsafe or ambiguous fixes, secrets, and shared-system effects require explicit authority and remain unresolved without it. Preserve intentional exceptions, behavior/contracts, user edits/tests, and proven correctness/security/compatibility/product obligations. No compulsory aesthetic cleanup.
- Validation requires baselines where possible, focused reversible changes, relevant permitted checks, pre-existing-failure disclosure, affected-coverage reassessment, and reverting only own failing edits. Unexamined files/categories, unsafe remedies, and unavailable verification stay visible; no false exhaustive claim.
- Risk-review SKILL/checks and idea-to-pr receive minimal coherent handoff corrections: explicit report mode, scope/source/coverage/findings, and SOURCE REVIEW MODE restrictions. Their existing no-edit/no-test boundaries remain; refactor's root default cannot grant them writes. No unrelated skill, agent, installer, or portable-configuration redesign was made.

Executed validation for this surface:

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v`: **36 pass** (ten original, fifteen updated encapsulation checks, eleven public-surface wording/structure checks). Coverage includes bare exhaustive/fix, four narrow goals, report parity/argument orders, grammar/rejection wording, all method permissions, external callers, safety/validation, protected corpus, and exact user mapping-table bytes. Existing single-owner/finding-reuse and alias tests remain. These static assertions do not exercise actual flag rejection or runtime enforcement.
- `bash -n install.sh && bash install/tests/install.test.sh`: **pass**, nine offline temporary-fixture groups.
- `bash harness/pi/tests/package-patches.test.sh`: **pass**, four temporary-fixture scenarios.
- `git diff --check`: **pass**.
- Deslop lint reports no candidates in the root skill, reference, or eleven internal method/mode files. Across current plan/evidence files it flags 12 technical platform nouns or exact required command paths, including preserved historical records. These 12 candidates remain intentional.
- A Python SHA-256/path-set comparison against the supplied pre-surface protected manifest: **112/112 byte-identical files**, with the exact path set unchanged. This includes the four datasets, all 17 exact rank/path cards, unranked summary, and MIT license. The fixed aggregate path/hash digest is `cb24497f71e95f0bdd3c27658f04f48020572ed6212ec370135e42ac9cca01a9`; a permanent static test checks it without a /tmp dependency.
- The user's padded principles table remains byte-identical (SHA-256 `7e4fcb7866d92416ead3389c41a4c9e3ff868ebfabdb5bd145cc020cdfffaa6d`). The srp trigger and declared alias tests remain intact. The principle index hash is unchanged.
- `git rev-parse HEAD` remains `615378008972c923d772e138f466285f2f6db84b`; `git diff --cached --name-only` is empty. Existing dirty absorption work is preserved. No branch/worktree creation, staging, commit, push, installation into real runtime destinations, or remote operation occurred. The redesigned skill was authored, not executed against this repository.

These are prose/static-contract checks and offline installer tests, not agent runtime behavioral proof or enforced tool isolation. No runtime parser/application, new Jev calls, replay execution, or calibration claims were added. This paragraph records the historical pre-review state. The subsequent independent Anthropic source review and correction recheck closed R1–R5 and M1/L1–L5/N1–N2 with zero blocking findings for this local scope. The coordinator verified OpenAI production and Anthropic review from successful session messages. The final recheck passed all 36 static tests and protected path/hash/table checks. No whole-PR readiness is claimed.

## Limits and next step

The independent source review and correction recheck cover this local refactor scope.
Static document/data checks and offline installer tests do not prove agent compliance.
The 26 replay fixtures remain unexecuted. Earlier synthetic Jev evidence is unchanged.

Runtime skills were not uninstalled. After merge, refresh installation and remove
stale specialist links if needed. The installer removes only dangling links;
a link into another still-existing checkout can remain valid and needs explicit
removal. Do not infer runtime removal from source discovery. Whole-PR readiness gates
and any authorized publication remain the coordinator's next steps.
