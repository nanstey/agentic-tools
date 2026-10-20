# Unified review

- Status: planning the security and code-review extension. Earlier work remains in draft PR [#114](https://github.com/nanstey/agentic-tools/pull/114). Local refactor review is complete. Whole-PR readiness gates remain incomplete.
- Summary: propose `/security` under code-quality and `/code-review` under workflow. The workflow runs every code-quality skill in a separate report-only process and synthesizes one shared packet. `/pr review` calls the workflow and owns PR actions. The proposed `code-review` name has a reserved-name conflict.
- Boundary: this extension changes planning artifacts only until explicit approval. Preserve existing local skill changes. No staging, commits, pushes, remote changes, new branch/worktree, or runtime installation. The one-PR default, advisory Jev, and main-model routing remain unchanged.
- Authorized internal rename: simplification assets now live at `refactor/references/simplify/`; the public `simplify` entrypoint is unchanged. Static validation passes after the rename; the earlier independent refactor review is before this rename and does not review it.

## Design
| Document | Current design |
| --- | --- |
| [Proposal](./proposal.md) · [Offline HTML](./proposal.html) | Earlier approved design; standalone specialist preservation is superseded by the encapsulation decision below |
| [Build checklist](./specs/01-unified-review.md) | Observable success criteria, shared packet contract, validation limits, and one-PR delivery |
| [Pilot protocol](./pilot.md) | Labeled replay, deterministic safeguards, and future operational measurements |
| [Build verification](./evidence/build-verification.md) | Earlier static/live checks and independent-review limits |
| [Encapsulation verification](./evidence/refactor-encapsulation.md) | Four public goals, exhaustive/fix default, caller-safe report mode, 112 immutable files, 36 static wording/structure checks, and offline installer discovery |

`/pr` owns PR lifecycle. Proposed `skills/code-quality/risk-review/SKILL.md` shares the impact packet, Jev rubrics, and source-review contract. Build/idea-to-pr supply outcome evidence and reuse matching packets. `/refactor` preserves specialist methods, reports, and datasets internally. Standalone sniff, fresh-air, extract, dry, srp, principles, deep-review, and ponytail entrypoints are removed; risk-review and shared workflow utilities remain external.

## Stage status
| Stage | Status |
| --- | --- |
| Repository, usage, and source research | Existing evidence retained unchanged |
| Revised proposal | Approved for implementation through the user's `build` invocation |
| Plan validation | Earlier source, prose, HTML, link, and history checks retained |
| Implementation approval | Earlier scope approved. The security/workflow extension requires a completed plan and explicit approval |
| Specs and implementation | Shared contract, internal refactor methods, routes, workflows, fixtures, and source-review mode implemented |
| Build validation | 36 static wording/structure tests pass: ten original, fifteen encapsulation checks, eleven public-surface checks. Offline installer (9 groups) and patch suites (4 scenarios) passed earlier. Earlier five synthetic Jev cases are unchanged |
| Independent source review | Anthropic source review and correction recheck closed R1–R5 and M1/L1–L5/N1–N2 with zero blocking findings. The coordinator verified OpenAI production and Anthropic review from successful session messages. Local refactor scope only, not whole-PR readiness |
| Review-layer extension plan | In progress. Planner assigned product, architecture, program-design, vertical-slice, and discovery artifacts. No implementation. Naming decision remains open |
| Publication | [Draft PR #114](https://github.com/nanstey/agentic-tools/pull/114) published. Readiness remains incomplete |

Proposed PR order: outcome evidence → current-SHA required CI independent of review → quality → security → automated-review-dependent required CI → human readiness.

Trace changed behavior through named consumers, shared state, authority, and deployment/trust/data boundaries. Cite reach and containment evidence, distinguish consequences/recovery from uncertainty, and select required checks/expertise. Sizes measure workload only. Sensitive effects and policy require scrutiny regardless of Jev answers. Jev cannot reduce coverage, downgrade requests, declare clean/ready, or authorize edits/commits during the advisory pilot. Runtime calibration is not done or claimed.

Human-dependent jobs, human approval, merge queue, and release flag/rollback policy remain later gates. Missing material evidence cannot pass.

Quality and security share three review/fix rounds, including initial review. Each fix head requires another round and affected outcome/CI/quality/security checks. Monitor consumes current-head review state without duplicate review or nested loops.

Convergence requires no unresolved verified requests and complete current evidence. Nits and unchanged existing findings do not block or drive rounds. Expected required CI needs supported draft/manual triggers before readiness. Ready-only checks require workflow/trigger changes or return blocked, never an inferred pass.

## Slices
All slices share [one build checklist](./specs/01-unified-review.md), one branch, and one PR. The shared packet and gates couple these changes.

| # | Slice | Status | PR |
| --- | --- | --- | --- |
| 1 | Shared impact/review packet, advisory Jev questions, finding categories, check selection, and preserved internal methods | Implemented. Static checks pass | [#114](https://github.com/nanstey/agentic-tools/pull/114) (draft) |
| 2 | Refactor exhaustive/fix default, simplify/extract/principles/smells goals, report-only option, and internal methods/assets | Implemented. Static checks pass; runtime compliance unproven | [#114](https://github.com/nanstey/agentic-tools/pull/114) (draft) |
| 3 | PR mode safeguards, shared quality/security budget, CI/monitor/readiness, and workflow reuse | Implemented. Static checks pass | [#114](https://github.com/nanstey/agentic-tools/pull/114) (draft) |
| 4 | Regression fixtures and advisory pilot protocol for defects, noise, rounds, and human effort | Implemented. Operational measurements remain future work | [#114](https://github.com/nanstey/agentic-tools/pull/114) (draft) |

## Evidence
- [Repository audit](./evidence/skill-audit.md) and [inventory](./evidence/skill-inventory.json).
- [Usage method and limits](./evidence/usage-audit.md) and [aggregate counts](./evidence/usage-counts.json).
- [Anthropic sources and distinctions](./evidence/anthropic-review.md).
- [Earlier checks and review limits](./evidence/verification.md).
- [Current official impact-analysis and TypeSafe sources](./proposal.md#sources).

Historical audit evidence and the proposal/HTML retain earlier observations and recommendations, not current standalone-entrypoint, router, or permission approval. The encapsulation verification records the current migration. The earlier detailed proposal remains in Git at `71a0fef`. Later user decisions below supersede conflicting recommendations in earlier design artifacts and evidence.

## Decision log (history, append-only)
- 2026-10-20 — Started research and planning only. Keep the existing task branch and worktree.
- 2026-10-20 — Selected `.plans/` because the repository already tracks plan folders there.
- 2026-10-20 — Assigned three independent read-only tasks: repository audit, historical usage audit, and Anthropic review research. Each task writes outside the checkout.
- 2026-10-20 — The requested deliverable is one self-contained plan with an audit appendix. Product intent, architecture, program design, and vertical slices will form ordered sections in `proposal.md`.
- 2026-10-20 — Implementation, skill changes, agent changes, harness changes, and PR publication remain outside this approval gate.
- 2026-10-20 — Completed all three research assignments. Preserved sanitized evidence in this folder and integrated the results into the proposal.
- 2026-10-20 — Counted confirmed nested-tool calls after checking trace semantics. The parent reran 17 parser fixtures and four bound fixtures successfully.
- 2026-10-20 — Selected `risk-review` because `review` conflicts with reserved commands. Proposed merging `deep-review` into its structural lens and `extract` into `refactor`.
- 2026-10-20 — Rejected a new review runner. Existing harness dispatch must prove family and tool enforcement before automatic integration.
- 2026-10-20 — Checked successful-message model provenance. Research and proposal production used OpenAI after Anthropic quota failure. Cross-family plan review remains unavailable.
- 2026-10-20 — Prepared a local planning-artifact commit on the existing task branch. No remote publication or implementation is part of this deliverable.
- 2026-10-20 — Completed the plan and stopped at the user approval gate. No specs or implementation files exist for these slices.
- 2026-10-20 — User requested a much shorter proposal. Keep deep-review and extract accessible, superseding their proposed removal. Preserve structural scrutiny, manual lenses, reports, and datasets.
- 2026-10-20 — Propose refactor as a thin inspect/extract/simplify/plan router. Separate diagnosis, review, planning, and authorized fixes. Consolidate shared interfaces rather than every specialist.
- 2026-10-20 — Unknown historical provenance and same-family capacity no longer block the proposed process. This supersedes family/authentication enforcement prerequisites without changing runtime rules. We claim no independent review.
- 2026-10-20 — User selected outcome evidence → independent required CI → quality → security → human readiness. Review-dependent required jobs follow prerequisites. Human approval, merge queue, and release controls remain later gates.
- 2026-10-20 — Revised Markdown, short offline HTML, and current index only. Approval remains pending. No specs, implementation, commits, or pushes.
- 2026-10-20 — User requested specific PR workflow changes and triggered loops. Propose one three-round quality/security budget, current-head evidence, explicit mode safeguards, and shared lifecycle/monitor gates.
- 2026-10-20 — User identified lost blast-radius detail. Restored condensed R0–R3 thresholds, mandatory floors, counting rules, uncertainty handling, and review depth from the earlier proposal. Thresholds remain provisional. Approval remains pending.
- 2026-10-20 — User selected local request/nit/existing categories, separate from severity/certainty. Verified requests govern finding-based readiness, while evidence and required gates remain independent. Nits and unchanged existing findings do not drive fixes or rounds. Ready-only CI requires draft/manual triggers or workflow changes before readiness, otherwise blocked. Approval remains pending.
- 2026-10-20 — User approved replacing numerical R0–R3 size/time/coverage/deployment tiers and fixed reviewer/effort mapping with evidence-led change impact analysis. Named reach paths, consequences, containment/recovery, and uncertainty select checks/expertise. Sizes measure workload only. Add advisory Jev claim-support, per-domain, and finding-adequacy/category judgments under deterministic safeguards. This supersedes numerical tiers/floors and effort mapping above, not sensitive-effect obligations or request/loop/CI rules. Revised these three plan files only. No specs, implementation, runtime calibration, commits, or pushes. Implementation approval remains pending.

- 2026-10-20 — User invoked `build` and requested all slices as one PR. This approves implementation and publication, superseding the earlier planning-only gate. Keep the existing isolated branch and task edits. Risk still scales review depth through impact evidence and required checks. Do not restore size-based tiers or automatic model routing. Add one shared build checklist and preserve the historical decision log.

- 2026-10-20 — Implemented all slices on the existing branch. Nine static tests pass over the contract and 26 labeled unexecuted replay fixtures. Five live synthetic Jev cases exercise supplied-state judgments, with no calibration or automatic thresholds. Explicit SOURCE REVIEW MODE connects callers to the reviewer profile. Anthropic quota prevents independent source review. Keep publication draft and operational pilot measurements pending.

- 2026-10-20 — User changed the workflow default to one PR across all slices in one repository. Multiple PRs require an explicit user request or changes across repositories. Align idea-to-pr and build, retain per-slice validation, and stack only user-requested dependent PRs. Add a regression assertion. Ten static tests now pass.

- 2026-10-20 — Commit the shared review skill, refactor router, and coupled PR/workflow contract separately. Merge current main without rewriting history. All ten static tests, offline installer/patch checks, catalog checks, and PR scope/credential scans pass afterward. The user-requested one-PR default includes cross-repository exceptions. Independent source review remains unavailable.

- 2026-10-20 — Published all slices in draft PR #114 and verified its structured body, main base, authoritative head, and draft state. A snapshot-only monitor check found no threads or observed jobs. Policy discovery found no expected Actions/branch-rule checks, not an inferred empty-check pass. Quality/security source coverage remains incomplete because independent review is unavailable. Keep the PR draft, with no merge or readiness claim.

- 2026-10-20 — User explicitly overrides standalone specialist preservation: absorb exactly sniff, fresh-air, extract, dry, srp, principles, deep-review, and ponytail into refactor as internal method references/assets; remove their standalone directories and catalog rows. Keep extraction placement, manual deep-review/DRY/SRP/principles lenses, full authorized simplification and report-only audit methods, datasets, and MIT attribution. Keep scope/prep/pr/risk-review and build/idea-to-pr/speclist external. Historical audits and proposal/HTML remain unchanged. Source-only implementation on this branch passes 19 static checks and offline installer/patch suites; runtime links and publication are not changed. See encapsulation verification for hashes, permissions, and stale-link limits.

- 2026-10-20 — User identified overlap between principles and DRY/SRP. Principles maps its existing dry and single-responsibility entries to the focused local procedures. All callers use one shared rule for stable finding IDs, matching scope/source/check coverage, and affected-coverage reassessment. One underlying issue counts once, while independent issues and all material findings remain separate. Plan reviews do not invent source facts or broaden the scope. All 107 dataset cards and indexes/map remain byte-identical. Two structural regression tests raise the current total to 21. No staging, commits, publication, or runtime changes.

- 2026-10-20 — User replaces topical principle folders with priority groups, then selects exactly 1-high, 2-med, and 3-low instead of twelve separate folders. Levels 1–4 are High, 5–8 Medium, and 9–12 Low. Each filename starts with its original two-digit priority. Preserve all 18 IDs, priority values, global order including ties, related IDs, aliases, source URLs, and prose. Only index grouping/path metadata and card category metadata change. This explicitly supersedes byte-identical preservation for those fields, not other datasets. Current validation passes 23 tests. The router and shared DRY/SRP rule remain unchanged.

- 2026-10-20 — User approves 17 unique ranks in the specified order and removes Clean Code from the ranked hierarchy. Retain its useful guidance in an unranked quality summary, with no extra review pass or finding. High covers ranks 1–4, Medium 5–13, and Low 14–17. Default design precedence never overrides correctness, security, compatibility, or explicit product requirements. Exceptions need evidence and guardrails. Retain lower-ranked material findings and shared DRY/SRP checks. This overrides earlier preservation of numeric priorities, order/ties, and the Clean Code ID, not retained card prose or other datasets.

- 2026-10-20 — User moves all four datasets into refactor/references, alongside method documents. Keep SKILL.md and REFERENCE.md at the root. Update active links and test anchors without prefixing index-relative paths. All 89 smell/technique cards, their indexes/map, and the MIT license retain exact bytes. The 17 retained principle card bodies match the original baseline after authorized metadata changes. The current 24-test suite and offline installer/patch suites pass. No staging, commits, publication, or runtime installation.

- 2026-10-20 — Correction after the later user edit: principles uses dry and srp as check triggers. The index declares srp as an alias of single-responsibility, which remains the finding/principle ID. Keep the user's padded table and alias choice. The prior 24-test success described the earlier tree. Independent review found one failure after that edit because the parser required single spaces and the old trigger. The corrected parser accepts padding, resolves declared aliases, and rejects unknown or ambiguous mappings. All 25 tests now pass, plus offline installer/patch suites. Discoverability, precedence wording, and graph metadata documentation are corrected. Removing compulsory aesthetic cleanup from the unranked summary remains intentional. No dataset, rank, runtime, or publication changes.

- 2026-10-20 — User approves four optional public goals: simplify, extract, principles, smells; fixes by default, optional --report. User then clarifies: “refactor without any options should be an exhaustive review and automatic fixes”. This supersedes the prior inspect/plan/dry/srp/deep-review public selectors, bare menu, manual-deep-only default, report/lite-first, and second selected-cut approval. Bare scope is maintained source/tests/config under repository guidance, never an implicit branch diff. Cover all 17 ordered principles, applicable smell families, DRY/SRP extraction placement, simplification, and structural maintainability; reuse findings and disclose gaps. All methods inherit caller authority; --report preserves identical chosen coverage without target edits/follow-on implementation, and external source reviewers gain no writes. Unknown options/old selectors stop safely. The 35 static checks, nine offline installer groups, four patch scenarios, diff checks, all 112 protected hashes/path set, exact padded mapping table, unchanged HEAD, and empty index passed before later corrections. No skill execution against this repository, installation, staging, commit, push, or remote change. Historical audits/proposal remain unchanged. Independent Anthropic recheck was pending at that point.

- 2026-10-20 — Applied bounded post-review corrections: declarative argument grammar rejects unsafe non-flag fallback; direct fix authority and stricter-caller inheritance are explicit; planning retains all recognized finding IDs; output precedence is centralized; and diff-only wording is removed from full-scope guidance. The suite now has 36 static wording/structure tests. Independent Anthropic source review and correction recheck closed R1–R5 and M1/L1–L5/N1–N2 with zero blocking findings. The coordinator verified OpenAI production and Anthropic review from successful session messages. No whole-PR readiness, runtime enforcement, replay execution, installation, staging, commit, push, or remote change is claimed.

- 2026-10-20 — User proposes a new code-quality `/security` skill and a new workflow `/code-review` skill. The workflow runs all code-quality skills in separate `--report` processes and synthesizes findings. `/pr review` calls it and owns PR report/fix/comment actions. Assigned a planning-only extension in this folder. The repository name registry flags `code-review` as a reserved Claude Code name. Resolve naming and approve the completed plan before implementation.
- 2026-10-20 — User authorized the bounded internal `references/ponytail` → `references/simplify` directory rename only. Active links, catalog attribution, and static path/hash guards now use `simplify`; upstream DietrichGebert/ponytail attribution and the exact MIT license remain. This is not an implementation decision for security, code-review, or verify, and prior independent refactor review predates the rename.
- 2026-10-20 — User approved `/review-code` under workflow, with `report|plan|fix` modes and default `report`, replacing proposed `/code-review` because that name is reserved. `/pr review` delegates code review and retains PR actions. Build and idea-to-pr call review-code. Scrutiny runs Mode A before building underspecified requests and supplies optional acceptance/obligations evidence, not an extra reviewer or round. Each review-code invocation reviews one round; a fix batch reserves the next round and returns it to the caller for delta review. No commits, pushes, or runtime installation in this implementation.
