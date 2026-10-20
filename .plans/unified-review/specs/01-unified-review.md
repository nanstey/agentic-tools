# Unified review: one PR

## Authority and scope

The user invoked `build` and requested one PR for the complete proposal.
Use the existing `review-process-plan` branch and isolated worktree.
Preserve the task's existing plan edits. Do not create a second branch or worktree.
Ship the shared contract, refactor routes, PR/workflow integration, and regression fixtures together.
Default to one PR for all slices in one repository. Split only for an explicit request or changes across repositories.
Keep `/deep-review`, `/extract`, manual methods, reports, and datasets accessible.
Do not add a runtime runner, SDK, service, graph platform, or main-model routing policy.

## Test Scenarios

These scenarios define expected behavior. Static contract checks cover their documented guards, not complete agent execution.
The live Jev record covers five synthetic judgment cases. The 26 protocol fixtures remain unexecuted replay scenarios.

- Given a small shared permission/default change and a large contained change, when reviewers assess effects, then the shared change receives broader checks.
- Given missing consumers, uncertain baselines, contradictory containment, or unavailable Jev, when reviewers assess coverage, then unsupported clean results remain forbidden.
- Given supplied evidence, when Jev returns judgments, then they remain advisory and cannot remove checks, dismiss requests, or authorize mutations.
- Given a verified introduced/worsened defect or material applicable obligation, when reviewers classify it, then it remains `request` despite remediation cost.
- Given optional `nit` or proven unchanged `existing` findings, when callers assess convergence, then those findings do not compel fixes or rounds.
- Given default/comment modes, when review runs, then it cannot edit or approve. Given own-PR fixes, authorization remains necessary.
- Given the initial round, when quality and security both pass, then they share round 1. Changed fix heads require another inherited round.
- Given missing current outcome/review/expected-CI evidence, when readiness runs, then it blocks. Empty checks and ready-only jobs cannot imply success.
- Given a refactor route, when dispatch runs, then it preserves the selected specialist method without implicit edits or unrelated work.
- Given matching review evidence, when build or idea-to-pr hands work to PR orchestration, then callers reuse it without duplicate full reviews.

## Shared integration contract

`risk-review` is read-only. It returns a portable review packet, not readiness or mutation authority.
The packet records scope, base/head identifiers, trusted policy identity, acceptance/outcome evidence, source citations, impact paths, containment, consequences, gaps, selected checks and their evidence, advisory Jev results, and stable findings.
Each finding records its ID/root cause, source evidence, provenance, category, severity/impact, confidence, and resolution.
Consumers compare packet snapshots before reuse and retain still-applicable findings.
Packet verdicts are `clean`, `changes_required`, or `incomplete`.
`clean` requires complete requested review coverage and no unresolved verified requests. It does not certify CI, readiness, approval, or merge permission.
Lifecycle separately reports `blocked` for failed prerequisites, missing evidence, exhausted budgets, or failed operations.
A caller owns the inherited round state: limit 3, initial round 1, current round, snapshot, and retained findings. Both clean quality/security visits can share one round. A changed fix head consumes the next round. Never create a fix head that the remaining budget cannot review. Base/policy changes invalidate evidence without resetting the budget.

## Implementation

Validate the authored skill contracts, references, fixtures, and integration instructions in each phase.
Do not infer runtime enforcement or calibrated model accuracy from those checks.

### 1. Shared contract and preserved methods

- [x] Add `skills/code-quality/risk-review/SKILL.md` after a CLEAR name check.
- [x] Add focused references for the packet, complete Jev questions, and review checks when needed.
- [x] Make refactor a thin inspect/extract/simplify/plan router. Preserve deep-review and extract.
- [x] Update the README catalog with exact frontmatter descriptions.
- [x] Validate frontmatter, names, relative links, read-only boundaries, question shapes, and required effects/checks.

### 2. PR and workflow integration

- [x] Integrate shared packets into review, lifecycle, CI, monitor, ready, build, and idea-to-pr.
- [x] Preserve other PR actions and owner/branch/remote safeguards.
- [x] Validate mode authorization, shared rounds, fix re-review, freshness, CI ordering, and reuse with no duplicate loops.

### 3. Regression proof and advisory pilot

- [x] Add representative fixtures and runnable repository-native checks without a runtime runner.
- [x] Execute ten static tests and five live synthetic Jev cases. Keep the 26 replay scenarios unexecuted and report the distinction.
- [x] Define pilot measurements for defects, clean changes, noise, rounds, and human effort. Do not claim longitudinal data or calibrated thresholds.
- [x] Check independent source-review availability. Anthropic quota prevents execution. Record this limitation without claiming independence.
- [x] Update plan state and design artifacts to match the implementation.

### 4. Publish one PR

- [x] Review and validate each commit scope. Explain lock-step skill coupling if bundled.
- [ ] Push the existing branch and create or update exactly one draft PR.
- [ ] Verify the structured PR body, head, base, draft state, and available checks.
- [ ] Do not merge or mark ready without the required current evidence and authorization.

## Validation limits

Prompt/static checks cannot prove harness-level tool restrictions or universal agent compliance.
Fixture reviews cannot establish complete dynamic or external dependency discovery.
Jev smoke tests, if executed, do not calibrate production thresholds.
The advisory pilot must not change permissions or mandatory review coverage.
