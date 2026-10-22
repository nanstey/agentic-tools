# Shared review packet

Return a structured object or a report with these named fields. Use empty lists and explicit missing/not-applicable states, not omitted coverage.

## Fields

| Field | Required contents |
| --- | --- |
| `version` | Packet contract version: `1`. |
| `scope` | Authoritative target/repository, included/excluded paths and reasons, comparison kind, requested review domains, working-tree separation. |
| `snapshot` | Immutable `base`, `head`, and trusted `policy` identity/version/source. Include policy digest and changed-instruction treatment. |
| `acceptance` | Applicable criteria/obligations, expected outcome, observed outcome evidence IDs, missing/failed evidence. |
| `inventory` | Changed sources plus generated/binary/submodule/dependency/rename entries, source correspondence, inspection status, unreadable/truncated content. |
| `evidence` | Stable evidence IDs, exact base/head snippets, snapshot identity, source path/range or immutable artifact identity, producer, and observed facts. Redact secrets without concealing material gaps. |
| `impact` | Named propagation paths/edges with evidence IDs, consumers, shared resources/state, execution authority, contracts and deployment/trust/data boundaries. Separate `reach`, `consequences`, `containment_recovery`, and `uncertainty`. |
| `checks` | Stable `check_id`, `domain`, selection reason/effect/policy, required expertise, coverage status, evidence IDs, and unresolved work. |
| `coverage` | Required only for `/review-code` packets. Include one row each for `risk-review`, `refactor`, `security`, `bugs`, `context-engineering`, `validator`, and `candidate-verifier`. Include subagent name/session, profile, explicit `model:thinking`, and status: `done`, `failed`, or `skipped-inapplicable` with reason. Only context-engineering may be skipped-inapplicable. The `security` row records triage and any required deep review separately. Standalone `risk-review` packets record only their own coverage in `checks`. |
| `validation` | Separately supplied test/outcome/CI evidence: producer, command/check, environment, snapshot, result, limits, and whether required by caller. State `not_run_by_reviewer`. |
| `gaps` | Missing/contradictory facts, affected claim/check, materiality, source coverage versus readiness-only prerequisite, and next inspection/owner evidence. |
| `jev` | Availability, exact state and question version, model/adapter, raw outputs/distributions, confidence where applicable, errors, policy/evidence versions, advisory handling. See [operation](jev.md). |
| `findings` | Stable findings using the fields and categories below, including retained/resolved/dismissed dispositions. |
| `freshness` | Evidence validity keys, reused/invalidated checks and reasons, prior packet identity, affected paths, reassessment scope. |
| `round_state` | Invocation-scoped, caller-supplied limit/current round/snapshot/retained findings, or `not_supplied`. Never initialize a nested loop or reset state within that invocation. |
| `verdict` | `clean`, `changes_required`, or `incomplete`. Include reasons, unresolved request IDs, and coverage completeness. |
| `next_actions` | Source inspection, validation, caller decisions, and separate followups. No implied edit/commit/approval authority. |

Domain keys for deeper review are `security`, `data`, `contract`, `deployment`, and `structure`.
Baseline check identities are `source`, `behavior`, `tests`, and `security_triage` (the last belongs to `security`).
Other check IDs name concrete checks within their domain. Record quality/security coverage separately even when they share evidence.

## Finding fields and categories

Each finding includes `id`, `root_cause`, `domain`, `check_id`, `summary`, source `evidence_ids`, `provenance`, `category`, `severity`, `impact`, `confidence`, `resolution`, and remedy/next action.
Provenance cites the base/head comparison or applicable obligation and explains introduction, material worsening, or proven unchanged baseline.
Severity describes seriousness. Impact names the consequence and affected consumers. Confidence describes evidence strength and remaining uncertainty. None replaces category.
Resolution records unresolved/resolved/dismissed status, evidence, and snapshot. Link duplicates to the retained root-cause ID.

| Category | Rule |
| --- | --- |
| `request` | A source-verified defect introduced or materially worsened by the change, or a material unmet acceptance/safety/contract obligation applicable to it. Finding-based blocker regardless of remediation cost. |
| `nit` | An optional preference, style choice, or minor improvement without a material applicable obligation. Nonblocking. No compulsory fixes or rounds. |
| `existing` | Baseline evidence proves the issue predates the change without material worsening. Nonblocking, separate followup. |

A new exposure or aggravation is a `request`, even if the mechanism predates the PR.
Uncertain baseline is a gap, never proof of `existing`. An applicable material obligation takes precedence over an unchanged mechanism.
Source-verify candidates before assigning final categories. Report uncertain candidates as gaps, not invented requests or reassuring existing findings.

Requests remain requests when remediation is expensive. Propose a narrower fix, split, or revert.
Send broad unrelated redesign/cleanup to a followup. Return blocked decisions to the caller when product scope or risky remediation needs authority.
Escalate critical existing issues separately. Only explicit applicable independent policy can gate those issues.

## Verdicts and caller boundaries

- `changes_required`: At least one unresolved verified request. Also disclose incomplete coverage. Missing checks cannot hide a known request.
- `incomplete`: No unresolved verified requests established, but material gaps or failed/unavailable review work prevent complete requested coverage. For `/review-code`, a missing coverage row, or a required row, validator, or candidate-verifier without `done` status, always makes the verdict incomplete.
- `clean`: Complete requested source-review coverage and no unresolved verified requests. A `/review-code` packet also requires a complete coverage table with every required row done. `context-engineering` may be `skipped-inapplicable` only with its recorded reason. Nits and unchanged existing findings may remain.

`clean` does not certify test execution, CI, readiness, human approval, or merge permission. It never grants gate or mutation permission.
Readiness-only prerequisites can be missing during a standalone source review. Disclose them under validation/gaps without claiming that coverage.
When missing validation prevents a material source conclusion, requested review coverage is incomplete instead.
The lifecycle caller separately reports `blocked` for failed prerequisites, exhausted budgets, missing required evidence, or failed operations.

## Freshness, reuse, and delta review

Use `(scope/comparison, base, head, trusted_policy_version_or_digest, domain, check_id, evidence_version)` as the evidence validity key.
Acceptance/outcome, question, and model versions also belong to judgments that depend on them.
A matching head alone does not prove validity. Verify source evidence IDs resolve to exact snippets/locations at their recorded snapshot.
Check producer/environment and content identities for validation artifacts. Stale tests are not current-head validation.

On a changed head, invalidate readiness and reassess changed impact plus affected prior paths, checks, outcomes, and security conclusions.
Retain still-applicable requests and stable IDs/root causes. Rebase citations against the current snapshot without erasing history.
Mark resolved/dismissed findings with evidence. Do not repeat them without new evidence.
Explicitly justify reused unaffected evidence. Base/policy changes invalidate freshness and require full reassessment when effects are broad.
Material unknown reach requires more inspection, not a delta-only assumption.

The caller owns the invocation-scoped quality/security limit: limit 3, initial round 1, current round, snapshot, and retained findings.
Both clean quality/security visits can share one round. Each changed fix head consumes the next round.
Never create a fix head without a round to review it. Base/policy changes do not reset the limit within an invocation.
This source skill performs one requested review, never fixes, loops, or recursively invokes PR review.
