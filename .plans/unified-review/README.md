# Unified review

- Status: implemented and locally validated. One draft PR awaits publication.
- Summary: Keep `/deep-review` and `/extract`. Use evidence-led change impact analysis, advisory Jev judgments, and bounded PR loops with `request`/`nit`/`existing` findings.
- Boundary: implement and publish one PR on the existing branch. Do not merge. Keep Jev advisory and main-model routing unchanged.

## Design
| Document | Current design |
| --- | --- |
| [Proposal](./proposal.md) · [Offline HTML](./proposal.html) | Approved command routes, impact paths/checks, Jev questions/safeguards, findings, bounded loops, and workflow integration |
| [Build checklist](./specs/01-unified-review.md) | Observable success criteria, shared packet contract, validation limits, and one-PR delivery |
| [Pilot protocol](./pilot.md) | Labeled replay, deterministic safeguards, and future operational measurements |
| [Build verification](./evidence/build-verification.md) | Executed static/live checks and independent-review limits |

`/pr` owns PR lifecycle. Proposed `skills/code-quality/risk-review/SKILL.md` shares the impact packet, Jev rubrics, and source-review contract. Build/idea-to-pr supply outcome evidence and reuse matching packets. `/refactor` preserves specialist methods, reports, and datasets.

## Stage status
| Stage | Status |
| --- | --- |
| Repository, usage, and source research | Existing evidence retained unchanged |
| Revised proposal | Approved for implementation through the user's `build` invocation |
| Plan validation | Earlier source, prose, HTML, link, and history checks retained |
| Implementation approval | Approved. User requests one PR for all slices |
| Specs and implementation | Shared contract, routes, workflows, fixtures, and source-review mode implemented |
| Build validation | Ten static tests and five live synthetic Jev cases. See build verification |
| Independent source review | Unavailable because Anthropic quota prevents execution. No independence claimed |
| Publication | One draft PR pending. Readiness remains incomplete |

Proposed PR order: outcome evidence → current-SHA required CI independent of review → quality → security → automated-review-dependent required CI → human readiness.

Trace changed behavior through named consumers, shared state, authority, and deployment/trust/data boundaries. Cite reach and containment evidence, distinguish consequences/recovery from uncertainty, and select required checks/expertise. Sizes measure workload only. Sensitive effects and policy require scrutiny regardless of Jev answers. Jev cannot reduce coverage, downgrade requests, declare clean/ready, or authorize edits/commits during the advisory pilot. Runtime calibration is not done or claimed.

Human-dependent jobs, human approval, merge queue, and release flag/rollback policy remain later gates. Missing material evidence cannot pass.

Quality and security share three review/fix rounds, including initial review. Each fix head requires another round and affected outcome/CI/quality/security checks. Monitor consumes current-head review state without duplicate review or nested loops.

Convergence requires no unresolved verified requests and complete current evidence. Nits and unchanged existing findings do not block or drive rounds. Expected required CI needs supported draft/manual triggers before readiness. Ready-only checks require workflow/trigger changes or return blocked, never an inferred pass.

## Slices
All slices share [one build checklist](./specs/01-unified-review.md), one branch, and one PR. The shared packet and gates couple these changes.

| # | Slice | Status | PR |
| --- | --- | --- | --- |
| 1 | Shared impact/review packet, advisory Jev questions, finding categories, check selection, and preserved manual lenses | Implemented. Static checks pass | Pending |
| 2 | Refactor inspect/extract/simplify/plan routes and shared extract alias | Implemented. Static checks pass | Pending |
| 3 | PR mode safeguards, shared quality/security budget, CI/monitor/readiness, and workflow reuse | Implemented. Static checks pass | Pending |
| 4 | Regression fixtures and advisory pilot protocol for defects, noise, rounds, and human effort | Implemented. Operational measurements remain future work | Pending |

## Evidence
- [Repository audit](./evidence/skill-audit.md) and [inventory](./evidence/skill-inventory.json).
- [Usage method and limits](./evidence/usage-audit.md) and [aggregate counts](./evidence/usage-counts.json).
- [Anthropic sources and distinctions](./evidence/anthropic-review.md).
- [Earlier checks and review limits](./evidence/verification.md).
- [Current official impact-analysis and TypeSafe sources](./proposal.md#sources).

Evidence records earlier observations and recommendations, not current approval. The earlier detailed proposal remains in Git at `71a0fef`. The current proposal supersedes conflicting recommendations below and in evidence.

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
