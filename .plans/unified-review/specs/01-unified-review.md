# Unified review: one PR

## Authority and scope

The user invoked `build` and requested one PR for the complete proposal.
Use the existing `review-process-plan` branch and isolated worktree.
Preserve the task's existing plan edits. Do not create a second branch or worktree.
Ship the shared contract, refactor routes, PR/workflow integration, and regression fixtures together.
Default to one PR for all slices in one repository. Split only for an explicit request or changes across repositories.
Keep extraction, deep-review, and all eight quality methods, reports, and datasets accessible through `/refactor` only. The 2026-10-20 user override removes standalone sniff, fresh-air, extract, dry, srp, principles, deep-review, and ponytail skills. Shared scope/prep/pr/risk-review and workflow tools remain external.
This public-surface follow-up is source-only: do not stage, commit, push, mutate remotes, install into runtime directories, or execute the redesigned refactor skill against this repository.
The latest user decision supersedes inspect/plan/dry/srp/deep-review public selectors, menu-only bare invocation, report/lite-first defaults, manual-only deep review, and second approval for selected cuts. Public syntax is `[simplify|extract|principles|smells] [scope] [--report]`; internal capabilities and stricter caller permissions remain.
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
- Given bare `/refactor`, when invoked by the user, then it exhaustively reviews all four goals across maintained source/tests/config and applies supported behavior-preserving fixes without another report/approve cycle. It never silently substitutes a diff, shallow smell scan, or all-66-techniques transformation.
- Given one of simplify/extract/principles/smells, then the primary goal narrows and matching evidence is reused rather than every method running for every goal. Extraction includes concrete same/other/new-file placement; principles covers all 17 in approved rank order.
- Given `--report` before or after scope in bare or selected forms, then chosen coverage is identical to fix mode, with no target source edits or follow-on implementation. At most one goal may precede scope; two goals, a goal after scope, invalid/unmatched scope, unknown flags, old selectors, and unrecognized non-flag tokens stop, never fall through to auto-fix. Explicit `./` paths may identify colliding existing names.
- Given no explicit scope, then repository guidance, maintained paths, and exclusions define full scope. Generated/vendor/dependency/build output is excluded. Unexamined units/categories remain explicit coverage gaps, not an exhaustive claim.
- Given external risk-review/source-review callers or a merely loaded method, then the root fix default grants no new authority. Methods receive mode/scope/source/coverage/evidence/caller constraints; read-only callers retain their test/build/write prohibitions.
- Given a safe fix, then establish a baseline where possible, preserve user edits/tests and intentional exceptions, validate reversible changes, and revert only own failing edits. Meaningful API/behavior/dependency changes, ambiguity, secrets, and shared systems remain unresolved without explicit authority.
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
- [x] Make refactor the sole entrypoint, with optional simplify/extract/principles/smells goals and `--report`. Bare invocation is exhaustive review plus supported automatic fixes, not a menu. Keep eight internal methods and reject unsupported old selectors/flags without edits.
- [x] Cover simplification plus structural/deep maintainability, all applicable smell families, all 17 ordered principles, and DRY/SRP extraction placement for bare scope. Reuse source-matched findings and single DRY/SRP procedures; disclose incomplete coverage.
- [x] Preserve retained principle prose/IDs/ranks/paths, all smell/technique cards and indexes/map, unranked summary, user's padded srp mapping, extraction placement, planning confidence/fast-path gates, and full MIT license. All 112 protected files remain byte-identical for this follow-up.
- [x] Thread one mode/scope/source/coverage/caller contract through every method and simplification mode. Direct invocation authorizes safe fixes without a second selected-cut gate. `--report` has identical coverage but no target edits/follow-on implementation. External callers and mere references gain no writes.
- [x] Apply the approved unique ranks 1–17. Group ranks 1–4 in `1-high`, 5–13 in `2-med`, and 14–17 in `3-low`. Prefix each filename with its unique two-digit rank. Retain Clean Code guidance as an unranked quality summary, not an extra result or pass.
- [x] Bound default design precedence by correctness, security, compatibility, and explicit product requirements. Exceptions require evidence and guardrails. Keep lower-ranked material findings.
- [x] Move all four datasets into `refactor/references/`. Keep index paths relative to their index directories and root SKILL.md as the only entrypoint.
- [x] Remove all eight standalone directories/catalog rows and update live incoming method links without changing Jev questions.
- [x] Reuse focused DRY/SRP checks in principles and extraction. Apply one shared finding rule across risk-review callers, with matching scope/source/check coverage and no duplicate counting.
- [x] Preserve the user's `dry`/`srp` check triggers and padded table. Resolve `srp` through its declared `single-responsibility` alias. Validate padding, registered aliases, and rejection of ambiguous/unknown triggers.
- [x] Update the README catalog with exact frontmatter descriptions.
- [x] Validate frontmatter, names, relative links, context-sensitive mutation boundaries, question shapes, required effects/checks, safety exceptions, and baseline/validation obligations.

### 2. PR and workflow integration

- [x] Integrate shared packets into review, lifecycle, CI, monitor, ready, build, and idea-to-pr.
- [x] Preserve other PR actions and owner/branch/remote safeguards.
- [x] Validate mode authorization, shared rounds, fix re-review, freshness, CI ordering, and reuse with no duplicate loops.

### 3. Regression proof and advisory pilot

- [x] Add representative fixtures and runnable repository-native checks without a runtime runner.
- [x] Execute 36 static wording/structure tests (ten original, fifteen encapsulation/overlap/rank/summary/alias checks, eleven public-surface checks) plus earlier offline installer (9 groups) and patch suites (4 scenarios). Preserve the earlier five live synthetic Jev cases unchanged. Keep the 26 replay scenarios unexecuted and report the distinction.
- [x] Define pilot measurements for defects, clean changes, noise, rounds, and human effort. Do not claim longitudinal data or calibrated thresholds.
- [x] Record earlier independent-review limits and partial R1–R5 corrections as historical states, not current review status or whole-PR readiness.
- [x] Obtain independent Anthropic source review and correction recheck of the redesigned surface. R1–R5 and M1/L1–L5/N1–N2 are closed with zero blocking findings for this local scope. The coordinator verified OpenAI production and Anthropic review from successful session messages. This does not establish whole-PR readiness.
- [x] Update plan state and design artifacts to match the implementation.

### 4. Publish one PR (earlier completed work; not authority to publish this source-only follow-up)

- [x] Review and validate each commit scope. Explain lock-step skill coupling if bundled.
- [x] Push the existing branch and create or update exactly one draft PR.
- [x] Verify the structured PR body, head, base, draft state, and available checks.
- [x] Do not merge or mark ready without the required current evidence and authorization.

## Validation limits

Prompt/static checks cannot prove harness-level tool restrictions or universal agent compliance.
Fixture reviews cannot establish complete dynamic or external dependency discovery.
Jev smoke tests, if executed, do not calibrate production thresholds.
The advisory pilot must not change permissions or mandatory review coverage.
