# Review-layers discovery (2026-10-20)

Planning-only memo for the review-layer extension. Scope: new `security` skill, new `code-review` orchestrator, `/pr review` and `idea-to-pr`/`build` as callers. It adds to, and does not rewrite, the approved refactor work. Where it conflicts with earlier proposal text for this scope, the four `*-` documents in this folder take precedence.

## Method and actual checks run

Read-only inspection with file read, grep, find and ls tools. I ran **no** shell commands, tests, git commands, installer, or skill. Facts below about HEAD `6153780…`, the empty index, the 36 static tests, nine installer groups and four patch scenarios come from the parent task and the README (`.plans/unified-review/README.md` Stage status), not from my own execution. The author-helper name check was done by reading `known-names.json` (updated `2026-06-01`), not by update mode; I did not refresh it or claim current external names.

## Evidence

| Fact | Source |
| --- | --- |
| Code quality has three skill roots: `refactor`, `risk-review`, `scrutiny` | `skills/code-quality/` listing |
| Installer discovers every `SKILL.md` under `skills/` by directory | `install/modules/artifacts.sh:13` |
| Refactor: bare = exhaustive and auto-fix; `--report` keeps coverage, no edits or follow-on work | `refactor/SKILL.md:13-15`, `REFERENCE.md` "Execution context" |
| Refactor accepts an explicitly recognized diff/PR scope and rejects unknown tokens | `refactor/SKILL.md:27` |
| Refactor leaves API/behavior/dependency/secret/shared-system fixes to explicit authority | `refactor/SKILL.md:51` |
| Shared finding-reuse rule (stable ID, matching scope/source/coverage keys) | `refactor/REFERENCE.md:103-` |
| Risk-review is read-only, labels delegated tasks `SOURCE REVIEW MODE`, selects refactor's deep-review internally, "without automatic fanout" | `risk-review/SKILL.md:10-20,49` |
| Risk-review has no declared `--report`; no `argument-hint` | `risk-review/SKILL.md` frontmatter |
| Packet fields, verdicts (`clean`/`changes_required`/`incomplete`), freshness key, caller-owned budget | `risk-review/references/packet.md:5-23,51-55,62-78` |
| Baseline checks incl. `security_triage` for every change; deeper `security` check row | `risk-review/references/checks.md:8,10` |
| Callers must pass `mode: report`, `SOURCE REVIEW MODE`, "existing findings" | `checks.md:20`; asserted for risk-review and idea-to-pr in `tests/test_refactor_surface.py:154-178` |
| Scrutiny vendored; "Re-sync from upstream rather than editing the body"; bank/packs/grades/references unchanged | `scrutiny/SKILL.md:18` |
| Scrutiny has two modes only: self-interrogation (default) and interactive interview; no `--report` | `scrutiny/SKILL.md:24-28` |
| Scrutiny step 6 emits a `Plan:` and step 7 "Build after blocking decisions are resolved" | `scrutiny/SKILL.md:128-145` |
| Scrutiny guardrail: no claimed verification without evidence | `scrutiny/SKILL.md:180` |
| `/pr review` calls risk-review, default report-only, own `fix`, other `comment`, source acquisition without touching checkout, "Never nest/reset the loop or call `/pr review` recursively" | `pr/references/review.md:5,27-40,53` |
| Gate order outcome → required CI → quality → security → review-dependent CI → human; single limit-3 budget including initial round | `pr/references/gates.md:15-22,36-44` |
| Lifecycle invokes `/pr review <PR> fix` only after outcome and CI pass | `pr/references/lifecycle.md:27-28` |
| idea-to-pr and build load risk-review directly | `idea-to-pr/SKILL.md:113,118-124`; `build/SKILL.md:38-44` |
| Only callers that name risk-review: pr `gates.md:9,19`, `review.md:5,38`, `monitor.md:33`, idea-to-pr, build | grep of `risk-review` |
| Catalog sections "Workflow" (README:95-101) and "Code quality" (README:148-154) | `README.md` |
| Harness depth cap: "Subagents cannot spawn further (depth capped)"; OMP `task.maxRecursionDepth` can cap at one level | `harness/omp/APPEND_SYSTEM.md:20`, `harness/omp/README.md:45-48` |
| Pi children start with only configured extensions and a tool deny list | `harness/pi/README.md:13,32` |
| Existing validation: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s .plans/unified-review/tests -p 'test_*.py' -v` | `evidence/refactor-encapsulation.md:74,301` |
| 112 protected hashes (digest `cb24497f…`) and padded mapping table hash (`7e4fcb78…`) | `tests/test_refactor_surface.py:199-216` |
| Installer-discovery test restricts to refactor/risk-review names, so new names do not break it | `tests/test_refactor_encapsulation.py:354-372` |

## Name check (check mode, read-only)

Method: normalize; compare with `names.claude`/`names.codex` in `.agents/skills/check-skill-name/known-names.json` (updated `2026-06-01`); compare with the 52 `name:` frontmatter values found under `skills/`, `agents/`, `.agents/skills/`. Reserved status is only as of that date.

| Name | Exact reserved | Exact in repo | Near-match | Verdict |
| --- | --- | --- | --- | --- |
| `code-review` | **yes**, `names.claude` (`known-names.json:21`) | no | `review` (claude, codex), `risk-review` (repo) | **CONFLICT** |
| `security` | no | no | `security-review` (claude, `known-names.json:33`) | exact-clear, **RISKY** near-match (prefix) |
| `quality-review` | no | no | `review`, `ultrareview`, repo `risk-review` | exact-clear; token overlap, RISKY-low |
| `code-audit` | no | no | none found | exact-clear, no token overlap |
| `review-quality`, `review-code`, `change-audit` | no | no | `review` token on the first two | exact-clear |
| `appsec`, `threat-review`, `vuln-review` | no | no | `threat-review`/`vuln-review` share `review` | exact-clear |

Near-match is my judgment, not a tool result. Neither skill may be scaffolded until its name is `CLEAR` (`make-skill` safety rules). The user must choose. Suggested alternatives (not chosen): orchestrator `code-audit`, `quality-review`, `review-quality`; security `appsec`, `threat-review`, or keep `security` if the user accepts the near-match. Do not edit `known-names.json`.

## Scrutiny compatibility finding

The vendored body cannot be invoked in report mode as written: it has no `--report`, its default path ends in "Build and verify", and its interview mode asks the user questions. A caller prompt that says "do not build" would contradict the loaded skill text and rely on the child following an override. Options considered:

1. **Local report-mode section (recommended, not approved).** Add one short "Report mode" block plus a provenance sentence to `scrutiny/SKILL.md`; leave every question, pack, grade, reference and `LICENSE` byte unchanged. Adds a re-sync obligation, recorded in the provenance line.
2. **Prompt-only adapter in `code-review`.** Rejected: conflicts with step 7 in the loaded skill and depends on implicit flag handling.
3. **Byte-identical vendored body.** `code-review` marks scrutiny `unsupported` in `checks`/`gaps` and returns `incomplete`; never substitutes inline reasoning. This is the fallback if the user rejects option 1.

## Assumptions (not approved)

- A1 `/security` direct default is report plus safe scoped fixes, like refactor. Its default scope is the current local change with needed context; with no change it stops and asks for an explicit scope rather than scanning the repository.
- A2 `code-review` is report-only and accepts `--report` as an idempotent no-op; it has no fix mode.
- A3 All four children run in parallel in separate contexts. They have no data dependency, only a static coverage-delegation declaration.
- A4 Build must change with idea-to-pr because it carries the same direct `risk-review` handoff.
- A5 Same branch, one PR by default. PR #114 stays a draft whose readiness is unclaimed; this plan adds no PR status claim.

## Open question

Orchestrator name (and security near-match). Not blocking the plan, blocks slice 5 onward.

## Pending validation limits

No runtime proof exists. The 26 replay fixtures are unexecuted. Static wording tests cannot show that a runtime enforces read-only tools, separate contexts, or `--report`. Depth-capped runtimes cannot start children from a delegated coordinator. Whole-PR readiness remains incomplete. New work must keep these limits visible.
