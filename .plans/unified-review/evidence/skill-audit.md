# Repository audit evidence

This is the source audit. The [proposal](../proposal.md) records the final recommendations and resolves alternatives.

## Audit result

The repository has several review processes, not one review contract. Preserve specialist knowledge and separate review from remediation. Consolidate only wrappers that repeat the same decision.

Recommended consolidation:
- Merge `deep-review` into the report-only structural lens of `ponytail`. Preserve its comparison rules and evidence requirements.
- Merge `extract` into `refactor` as a second planning input path. Preserve its destination decision and placement rationale.
- Keep other audited skills. Narrow their routing and authority contracts before removing useful boundaries.
- Do not delete either public name until consumers, the catalog, and installer links migrate together.

These recommendations evaluate capability, safety, and composition. They do not measure invocation frequency. No session history was inspected. No absence of history implies lack of utility.

Scope: all ten code-quality skills, both dev skills, all three workflow skills, all seven planning skills, `scope`, `context-engineering`, `reflect`, `handoff`, all five agent profiles, and relevant Pi/OMP instructions. Total: 26 skills and five profiles. The machine-readable inventory is `skill-inventory.json`.

## Files Retrieved

Complete skill entrypoints read:
1. `skills/code-quality/deep-review/SKILL.md` (1-38).
2. `skills/code-quality/dry/SKILL.md` (1-45).
3. `skills/code-quality/extract/SKILL.md` (1-65).
4. `skills/code-quality/fresh-air/SKILL.md` (1-49).
5. `skills/code-quality/ponytail/SKILL.md` (1-92).
6. `skills/code-quality/principles/SKILL.md` (1-82).
7. `skills/code-quality/refactor/SKILL.md` (1-43).
8. `skills/code-quality/scrutiny/SKILL.md` (1-182).
9. `skills/code-quality/sniff/SKILL.md` (1-41).
10. `skills/code-quality/srp/SKILL.md` (1-47).
11. `skills/dev/git/SKILL.md` (1-36).
12. `skills/dev/pr/SKILL.md` (1-58).
13. `skills/workflow/build/SKILL.md` (1-51).
14. `skills/workflow/flow-design/SKILL.md` (1-72).
15. `skills/workflow/idea-to-pr/SKILL.md` (1-135).
16. `skills/planning/plan-init/SKILL.md` (1-93).
17. `skills/planning/product-review/SKILL.md` (1-48).
18. `skills/planning/program-design/SKILL.md` (1-47).
19. `skills/planning/proposal/SKILL.md` (1-81).
20. `skills/planning/speclist/SKILL.md` (1-51).
21. `skills/planning/system-architecture/SKILL.md` (1-46).
22. `skills/planning/vertical-slices/SKILL.md` (1-49).
23. `skills/agent/scope/SKILL.md` (1-43).
24. `skills/agent/reflect/SKILL.md` (1-43).
25. `skills/agent/context-engineering/SKILL.md` (1-167).
26. `skills/env/handoff/SKILL.md` (1-41).

Supporting files read:
- `AGENTS.md` (1-119), `.agents/skills/make-skill/SKILL.md` (complete), `.agents/skills/make-agent/SKILL.md` (complete): repository and authoring constraints.
- `agents/reviewer.md`, `agents/scout.md`, `agents/researcher.md`, `agents/planner.md`, `agents/worker.md` (complete): role contracts and model defaults.
- `README.md`, `harness/pi/README.md`, `harness/omp/README.md`, `harness/pi/APPEND_SYSTEM.md`, `harness/omp/APPEND_SYSTEM.md` (complete): catalog, managed artifacts, and routing.
- `skills/dev/pr/references/review.md` (1-161), `lifecycle.md` (1-45), `info.md` (1-42), `monitor.md` (1-67), `comments.md` (1-57), `ci.md` (1-41): review, remediation, and publication dependencies.
- `skills/dev/git/references/changes.md` (1-35): change-intent review and comparison contract.
- `skills/code-quality/ponytail/modes/review.md` and `modes/audit.md` (complete): report-only modes and scope exclusions.
- `skills/code-quality/fresh-air/REFERENCE.md` and `skills/code-quality/refactor/REFERENCE.md` (complete): dataset ownership and planning contracts.
- `install.sh` (27-81, 513-537, plus targeted matching lines 14-25, 143-214, 248-285, 461-530): collection, copying, patching, and stale-link behavior.
- `harness/pi/prompts/improve.md` (1-47), `harness/pi/self-improve.json` (complete), `harness/pi/extensions/pi-fallback.json` (complete): independent-review adapter and global fallback.
- `harness/pi/tests/package-patches.test.sh` (1-34), `package-extensions.test.mjs` (1-45), `pi-improve.test.sh` (1-35): available checks, not executed suites.
- `.plans/native-gh-media-attachments/README.md` and `.plans/setup-jev-ultrafast/README.md` (complete), `.plans/setup-jev-ultrafast/specs/01-add-jev-ultrafast-skill.md` (1-35), `.gitignore` (complete): existing plan layout and ownership conventions.
- Code-quality dataset indexes inspected with JSON parsing, counts, and hashes. Individual knowledge articles were not comprehensively audited.
- Installed `graphify/SKILL.md` read. No `graphify-out/graph.json` exists. No graph was built because that would require forbidden repository writes, dependency work, and delegation.

## Key Code and contracts

### Review comparison

`skills/dev/pr/references/info.md:24-30` owns the PR comparison:

```text
baseRefOid/headRefOid define the PR's true comparison
 git diff <baseRefOid>..<headRefOid>
Keep committed PR changes separate from working-tree changes
```

`scope` supplies non-PR boundaries. Its precedence is explicit target, uncommitted changes, then branch delta (`skills/agent/scope/SKILL.md:12-16,28-36`). Review consumers must not silently replace that with the main branch.

### Review orchestration

`skills/dev/pr/references/review.md:38-51` hardcodes three perspective reviewers, then one synthesizer. Perspectives are correctness, design, and risk. It explicitly uses Pi's `subagent` and `agent: "reviewer"`.

`skills/workflow/idea-to-pr/SKILL.md:108-111` separates implementation, runtime QA, UI evidence, and optional independent quality review. These are different acceptance functions, not interchangeable reviews.

### Independent model check

`harness/pi/APPEND_SYSTEM.md:147-169` requires a different producer/reviewer model family. It requires successful-message model evidence, not profile defaults:

```sh
jq -r 'select(.type=="message" and .message.role=="assistant" and (.message.stopReason|IN("error","aborted")|not)) | "\(.message.provider)/\(.message.model)"' <log> | sort | uniq -c
```

This audit did not run that command against history. It records the current required verification contract only.

## Skill-by-skill evaluation

Each row names the canonical repository path. Consumer evidence records current migration obligations, not invocation history. Catalog-only exposure does not mean a skill is unused.

| Skill and canonical path | Purpose and overlap | Evaluated utility and recommendation | Consumer edges and migration obligations |
| --- | --- | --- | --- |
| `deep-review` — `skills/code-quality/deep-review/SKILL.md` | Strict structural maintainability review. Overlaps `ponytail lite`, the design perspective, and parts of `principles`. | **Merge into a report-only structural lens.** Its evidence/comparison rule is valuable, but its short checklist does not need a separate orchestrator. Preserve justified structural blockers, not merely line-count cuts. | Called explicitly by `idea-to-pr` at `skills/workflow/idea-to-pr/SKILL.md:111`. Calls `/pr info` or `scope` at its own `:13`. Catalog `README.md:132`. Update that caller and catalog before retiring the name. |
| `dry` — `skills/code-quality/dry/SKILL.md` | Read-only duplication analysis with false-coupling checks. Overlaps sniff's duplicate-code category and ponytail reuse. | **Keep as a specialist lens.** Classification of shared concepts versus incidental similarity prevents harmful extraction. Severity plus improvement value is more useful than shortest-code scoring (`:12-16,24-39`). | `extract` calls it at `skills/code-quality/extract/SKILL.md:21`. If `extract` merges, preserve this lens in the new refactor input route. `dry` invokes `scope` unless explicit at `:20`. Catalog `README.md:133`. |
| `srp` — `skills/code-quality/srp/SKILL.md` | Read-only responsibility/ownership analysis. Overlaps sniff and extraction planning. | **Keep as a specialist lens.** Its stakeholder/change-pressure analysis and warnings against cosmetic fragmentation add a distinct test (`:24-41`). | `extract` calls it at `skills/code-quality/extract/SKILL.md:22`. Preserve ownership evidence in merged planning. Catalog `README.md:134`. |
| `extract` — `skills/code-quality/extract/SKILL.md` | Composes DRY/SRP findings into extraction recommendations and exact destinations. Overlaps refactor planning and program design. | **Merge into `refactor` as a placement-focused path.** The valuable contract is `same file/other file/new file`, concrete paths, runtime/domain/cohesion rationale (`:24-28,40-65`). Do not discard that contract. Its wrapper otherwise re-runs two analyses unconditionally. | Calls `scope`, `dry`, and `srp` at `:20-22`. Catalog `README.md:135`. No audited orchestration explicitly invokes `extract`. Preserve direct user invocation migration, not just named callers. Expand `refactor` beyond mandatory smell IDs before redirecting. |
| `sniff` — `skills/code-quality/sniff/SKILL.md` | Evidence-based diagnosis mapped to reference smell IDs. Overlaps DRY/SRP, but supplies a taxonomy rather than final placement. | **Keep.** Stable IDs enable validated technique selection. Its 2-4 category focus avoids mandatory full taxonomy traversal (`:23-29`). Define a shared finding schema rather than duplicate every lens. | Exposes catalog `README.md:137`. Its `:12-13,26-29` bind output to the local smell corpus. `refactor/REFERENCE.md:46-50` explicitly requires indexes shared with sniff/fresh-air. Preserve IDs and references in any migration. |
| `fresh-air` — `skills/code-quality/fresh-air/SKILL.md` | Ranks techniques for validated smells, with fallback and confidence. Overlaps refactor's planning choices. | **Keep the selection boundary.** Mapping evidence, candidate detail loading, reversibility, and confidence provide a falsifiable decision stage (`:23-45`). This is not just a prose wrapper. It can be internal by default without deleting its independent capability. | `refactor` calls it at `skills/code-quality/refactor/SKILL.md:13,27,35`. Dataset paths in `fresh-air/REFERENCE.md:34-40`. If made an internal mode, update those edges and catalog `README.md:138`, and preserve confidence/fallback output. |
| `refactor` — `skills/code-quality/refactor/SKILL.md` | Validates findings, selects techniques, aggregates an implementation plan. Overlaps extract and speclist. | **Keep as the consolidated refactor-planning owner.** Accept smell-based input and DRY/SRP placement input without forcing artificial smell IDs. Delegate generic checklist formatting to speclist rather than duplicating it. Add an active planning-only stop rule (`:12-14,23-43` currently lacks the authoring contract's full guardrail). | Calls fresh-air at `:27`, owns final plan at `:13,30`. Reference requires smell and technique metadata at `refactor/REFERENCE.md:14-23`. Catalog `README.md:139`. A future speclist handoff is a recommendation, not an existing edge. |
| `principles` — `skills/code-quality/principles/SKILL.md` | Exhaustive prioritized principle evaluation for code or plans. Overlaps broad design review, but has ordered conflict resolution. | **Keep as an explicitly exhaustive lens, not the default review.** Evaluating all 18 principles gives traceable coverage. It costs more than a scoped risk review (`:27-37`). Its rigid emoji report is presentation policy, not essential review logic. Add explicit read-only/planning authority. | `idea-to-pr` requests it at `skills/workflow/idea-to-pr/SKILL.md:111`. Always calls `scope` at `:27`, uses `prep` at `:37`, binds corpus at `:14,29-35`. Catalog `README.md:136` misleadingly calls it concise. |
| `ponytail` — `skills/code-quality/ponytail/SKILL.md` | Simplifies branch code, with report-only lite and repo audit modes. Overlaps deep-review and reuse analysis. | **Keep, with an explicit mutation boundary.** The simplification ladder and verification/revert rule are useful. Default full mode edits code (`:19-32,60-66`), so this must not be an automatic review lens. Absorb deep-review only in report-only mode. Fix comparison routing before reuse. | Public catalog `README.md:141`. Mode contracts `modes/review.md:35-40` and `modes/audit.md:25-30` exclude correctness/security/performance. Its base logic `SKILL.md:27-28` uses origin HEAD and mixes local edits, unlike scope/PR authority. |
| `scrutiny` — `skills/code-quality/scrutiny/SKILL.md` | Resolves engineering uncertainty using dynamic domains, packs, grades, then builds. Overlaps discovery/planning/review but uses a question-bank decision method. | **Keep the knowledge and risk-resolution method.** Core/full retrieval and sufficiency gates are valuable (`:56-66,112-126`). Correct the authority boundary: a plan or architecture-review request currently reaches 'Build and verify' (`:143-145`). Do not route review-only work through that default. | Broad frontmatter triggers `:3-10` include plan/design/architecture review. Catalog `README.md:140`. No audited orchestrator explicitly invokes it. Preserve upstream attribution and re-sync constraint at `:17` if changing its adapter. |
| `git` — `skills/dev/git/SKILL.md` | Dispatches branch/worktree/change/commit/rebase workflows. `changes` is an intent/scope review, not full correctness review. | **Keep.** Central state-safety dispatch prevents review and shipping commands from drifting. Do not merge change grouping into correctness review (`references/changes.md:5-10,19-24`). | Dispatch `SKILL.md:19-25`. `build` calls branch/worktree and commit at `skills/workflow/build/SKILL.md:30,33`; idea-to-pr at `:105,112`; PR lifecycle at `skills/dev/pr/references/lifecycle.md:19-23`. `changes.md:10,20` uses scope or PR info. |
| `pr` — `skills/dev/pr/SKILL.md` | Sole PR dispatcher, including review/remediation/lifecycle. Overlaps build shipping, not specialist analysis. | **Keep.** Head-bound state gates and mutation modes are useful. Make review responsibility portable while retaining GitHub publication behavior in this adapter. Three reviewers plus synthesis should be a justified topology, not a mandatory cost for every change. | `/pr review` dispatch at `:27`. Lifecycle automatically calls review fix at `references/lifecycle.md:26`. Build completion calls PR at `skills/workflow/build/SKILL.md:34`; idea-to-pr at `:112`. `review.md:40,49` hardcodes Pi tools and requires migration for OMP/other harnesses. |
| `build` — `skills/workflow/build/SKILL.md` | Executes existing requirements in validated phases. Overlaps idea-to-pr's per-slice execution. | **Keep.** It is the useful direct path when requirements already exist. Do not force full discovery. Add a named acceptance-review checkpoint only when warranted, with separate checklist ownership. Current validation is mostly implementer-owned (`:29-36`). | Reads plan-init layout at `:20-21`, ships through git/PR at `:30-34`, changes design/index at `:35`. `flow-design` names build as caller at `skills/workflow/flow-design/SKILL.md:14`. Preserve shipping authorization restriction at build `:43`. |
| `flow-design` — `skills/workflow/flow-design/SKILL.md` | Designs execution roles, dependencies, gates, and return contracts without dispatch. Overlaps coordinator planning. | **Keep.** Explicit write isolation and acceptance ownership are distinct from implementation planning. Its inline fallback avoids needless orchestration (`:12-16,29-37`). | `idea-to-pr` calls it conditionally at `skills/workflow/idea-to-pr/SKILL.md:107`. Names caller build/user at `:14`. Ownership split at `:47`. Preserve design-only rule and let harness select agents/models. |
| `idea-to-pr` — `skills/workflow/idea-to-pr/SKILL.md` | Owns end-to-end state, evidence, planning, QA, and PRs. Overlaps all stages intentionally. | **Keep the coordinator.** Compact handoffs, single state owner, QA separation, and final audit add real guarantees (`:12-16,35-61,108-118`). Do not duplicate its full pipeline inside build or PR. Align review checkpoints to avoid repeated design/full-PR reviews without a risk reason. | Calls plan-init `:73`, proposal/focused planning `:87-90`, speclist `:96`, flow-design `:107`, specialist review `:111`, PR `:112`, reflect `:118`. `handoff` starts it at `skills/env/handoff/SKILL.md:13,26`. Preserve all edges and state ownership. |
| `scope` — `skills/agent/scope/SKILL.md` | Resolves bounded analysis targets and comparison evidence. Overlaps `/pr info` and `/git changes`, but owns non-PR scope. | **Keep.** Correct scope is a precondition for credible review. Standardize base resolution and exact SHA reporting across all lenses (`:12-16,28-36`). Avoid repeated confirmation when caller already supplied an explicit comparison. | Consumers: deep-review `:13`, dry `:20`, extract `:20`, principles `:27`, reviewer `agents/reviewer.md:55`, git changes `references/changes.md:10,20`. Scope itself calls PR info `:14,35`. |
| `plan-init` — `skills/planning/plan-init/SKILL.md` | Owns plan layout and README section ownership. Overlaps no actual review judgment. | **Keep.** This is the shared artifact/state contract, not disposable scaffolding. Its live index prevents handoff drift (`:42-74`). Make approval handling compatible with authorized autopilot without permitting source edits. | `idea-to-pr:73`, all focused planning input/location steps, build `:20-21`. Canonical owners at `plan-init:66-74`. Migration must preserve document links, slice numbering, and append-only decisions. |
| `proposal` — `skills/planning/proposal/SKILL.md` | One self-contained small-change plan. Overlaps four focused design artifacts by explicit design. | **Keep as the small-change path.** Its 'one path per concern' rule prevents duplicated artifacts (`:12-13`). Resolve approval semantics, not by deleting the shortcut. | `idea-to-pr:87`, plan-init layout `:29,38`, proposal delegates plan-init at `:53`, seeds slices `:37`. Downstream build accepts its plan at `skills/workflow/build/SKILL.md:20`. Preserve planning-only stop at proposal `:70-81`. |
| `product-review` — `skills/planning/product-review/SKILL.md` | Settles user outcomes/success/scope before technical design. Overlaps requirements triage, not code correctness. | **Keep.** It protects against implementing the wrong product. Optional reviewer feedback must stay distinct from mandatory human phase approval (`:23,34,42`). | `idea-to-pr:88`; can recommend prototype/system-architecture at own `:33`; plan-init ownership `:68`. Output `1-product-review.md` at `:34`. Preserve user-facing outcomes in downstream packet. |
| `system-architecture` — `skills/planning/system-architecture/SKILL.md` | Cross-component contracts, data flow, failure behavior. Overlaps program design only at boundary decisions. | **Keep.** External contracts and compatibility need a separate level from signatures/file placement. Its explicit defer rule is useful (`:26-30`). | `idea-to-pr:88`, product-review `:30,33`; sends internals to program-design at `:30`; writes indexed `2-system-architecture.md` at `:32`. Preserve approval/read-only rules `:36-46`. |
| `program-design` — `skills/planning/program-design/SKILL.md` | Concrete code shape, invariants, interfaces, and test seams. Overlaps planner profile but supplies a portable artifact contract. | **Keep.** It prevents implementation ambiguity after architecture is settled. Do not replace it with the planner's generic task list (`:12,27-33`). | `idea-to-pr:88`, system-architecture `:30`; recommends vertical-slices at own `:33`; owns indexed `3-program-design.md`. Preserve interfaces and validation seams. |
| `vertical-slices` — `skills/planning/vertical-slices/SKILL.md` | Defines complete observable increments and sequence, not task checklists. Overlaps speclist at verification boundaries. | **Keep.** Rejecting horizontal-only phases is a useful planning decision, not formatting (`:27-32`). Keep slice boundaries separate from steps. | `idea-to-pr:88`, program-design `:33`; seeds README slices and recommends speclist at own `:34`; plan-init owner `:69`. Preserve PR-per-slice mapping. |
| `speclist` — `skills/planning/speclist/SKILL.md` | Converts findings/design into ordered executable checklist artifacts. Overlaps refactor's generic checklist creation. | **Keep as the shared checklist serializer.** It supports standalone and per-slice outputs (`:12-14,35`). However, its own artifact contract does not require the two sections/checking ownership expected by idea-to-pr. Fix that schema mismatch. | Called by idea-to-pr `:96-99`, recommended by vertical-slices `:34`, consumed by build `:20,33`. Enforce `## Implementation` and `## Test Scenarios` for pipeline specs without claiming execution. |
| `context-engineering` — `skills/agent/context-engineering/SKILL.md` | Audits prompt/tool/retrieval signal and applies fixes. Overlaps review-process cleanup, not code correctness. | **Keep as an authoring-quality tool.** Its behavioral-value and just-in-time tests are useful (`:26-35,93-109`). It is not read-only: steps apply P1/P2 fixes (`:131-143`). Require review-only mode for audits like this one. | Catalog `README.md:87`. Its internal direct-edit edge is `:139`. No audited delivery coordinator calls it by name. Preserve its distinct prompt/retrieval remit rather than silently treating it as general code review. |
| `reflect` — `skills/agent/reflect/SKILL.md` | Turns observed session friction into durable tool improvements. Overlaps review of process, not current diff acceptance. | **Keep.** Root-cause prevention differs from acceptance review. Fix its authority contradiction: default approval-only `:13` and safety `:35` versus direct low-risk edits `:29`. | `idea-to-pr:118`; harness reflection adapter documented in `harness/pi/README.md:24-26,69-79`. This audit reads the definition only, not session records. Preserve explicit evidence and redaction requirements in the harness adapter. |
| `handoff` — `skills/env/handoff/SKILL.md` | Transfers ownership to a standalone Pi session in an Orca worktree. Overlaps supervised delegation only superficially. | **Keep as an explicit harness adapter.** Persistent ownership, duplicate-launch checks, and stopping the parent differ from bounded subagents (`:13,26-28,32-37`). It is not portable in the same sense as build/flow-design. | Pi routes user worktree tasks here at `harness/pi/APPEND_SYSTEM.md:59-62`. Starts idea-to-pr at own `:26`. Preserve no-subagent/no-supervised-orchestration rule and self-contained brief. |

## Architecture and review entry points

### Current routes

1. **Direct specialist review:** deep-review, dry, srp, sniff, principles, ponytail lite/audit. Each has different scope, findings, and authority rules.
2. **Branch intent review:** `/git changes` groups real diffs and flags unrelated work (`skills/dev/git/references/changes.md:5-10,19-24`).
3. **PR review:** `/pr review` runs three perspectives and a synthesis pass. Read-only unless `fix` or `comment` (`skills/dev/pr/references/review.md:5-9,38-51,119-156`).
4. **Automatic PR self-review:** `/pr` lifecycle runs `/pr review <PR> fix` once per verified head, unless skipped (`skills/dev/pr/references/lifecycle.md:26`). It does not review the resulting fix commit again.
5. **Feedback reconciliation:** `/pr comments` handles existing threads, not fresh review (`references/comments.md:5-7,40-42`). `/pr monitor` invokes comments/CI and verifies same-head state (`references/monitor.md:28-45`).
6. **Implementation acceptance:** idea-to-pr separates implementation, runtime QA, optional independent quality review, and final artifact audit (`:108-118`). Build has per-phase validation, but no equally explicit independent acceptance requirement (`build:29-36`).
7. **Planning review:** product-review creates product intent. Optional reviewer feedback on focused artifacts is author opt-in. Explicit user phase review is separately mandatory (`product-review:34,42,48`, analogous architecture/design/slice rules).
8. **Risk/design interrogation:** scrutiny answers domain questions and then builds. It is not safe as a read-only review entry without a local override (`scrutiny:143-145`).
9. **General delegated review:** Pi routes diff/plan/PR/verification/decision sanity checks to reviewer (`harness/pi/APPEND_SYSTEM.md:75`). Reviewer supports all five target classes (`agents/reviewer.md:15-51`).
10. **Harness self-improvement review:** `/improve` runs a blocking independent-family headless review until approval, then re-verifies and publishes (`harness/pi/prompts/improve.md:26-43`).
11. **Prompt/process review:** context-engineering can edit findings directly. Reflect proposes process improvements with conflicting direct-edit wording. Neither is a substitute for acceptance QA.
12. **Human UI review:** playwright-cli documents annotated UI/design feedback (`skills/tools/playwright-cli/SKILL.md:406`, targeted search only). This is a separate feedback mechanism, not an audited specialist code-review skill.

### Review topology risks

- A large idea can receive acceptance review, specialist quality review, final audit, and PR's three-perspective self-review. The contracts do not specify when an earlier review packet can satisfy a later gate (`idea-to-pr:108-118`, PR lifecycle `:26`). Define evidence reuse for the same head and criteria. Do not skip runtime QA because a code reviewer passed.
- PR review's shared raw diff and three reports can be large (`review.md:36,40,49`). Idea-to-pr instead requires compact packets and artifact links (`idea-to-pr:35-61`). Use one immutable comparison packet and bounded per-perspective evidence.
- PR review requires read-only child tools (`review.md:40,154`), but reviewer profile grants edit/write (`agents/reviewer.md:5`). The orchestrator must actually restrict tools. A prose instruction alone does not implement least privilege.
- Review fix accepts local findings but blocks architecture/product tradeoffs (`review.md:125-130`). Pi autonomy instead resolves architecture defaults from evidence (`harness/pi/APPEND_SYSTEM.md:3-12`). State whether a blocked result is a safety gate or merely an authority decision. Do not let generic autonomy silently bypass review safety.

## Model independence and profiles

### Current behavior

- Main Pi remains on the user's selected model except provider failure (`harness/pi/APPEND_SYSTEM.md:46-52`). Jev classifies subagent tier/thinking, not main-model selection (`:95-112`).
- Default profiles: scout Haiku, researcher Sonnet, planner Fable, worker GPT Sol, reviewer Opus (`agents/*.md:4`). All deny spawning (`agents/*.md:9-10`) and use leaf escalation.
- The parent selects reviewer family from the actual producer family. Reviewer fallback stays within the opposite family (`harness/pi/APPEND_SYSTEM.md:121-138`).
- Actual successful assistant messages must prove independence (`:161-169`). A mixed-family producer cannot have an independent single-family reviewer. Rerun production on one family or report the limitation.
- Global fallback can still cross families (`harness/pi/extensions/pi-fallback.json:3-6`). Therefore profile defaults do not prove independence. This is acknowledged, not solved merely by naming the opposite reviewer.
- Portable idea-to-pr allows a distinct self-review when no independent context is available (`skills/workflow/idea-to-pr/SKILL.md:108`). Pi imposes the stronger different-family requirement. Report that distinction instead of claiming universal cross-model coverage.
- OMP APPEND_SYSTEM prescribes `task` delegation (`harness/omp/APPEND_SYSTEM.md:16-20`), but does not define Pi's different-family routing or successful-message audit. OMP README says machine-local recursion depth is needed (`harness/omp/README.md:44-48`). Do not claim OMP has the same independence enforcement.

### Profile utility and constraints

| Profile | Utility and overlap | Recommendation / dependencies |
| --- | --- | --- |
| `agents/reviewer.md` | Broad evidence-based review, including plan feasibility and code health. Overlaps all lenses by role, not by detailed method. | Keep. Use specialist contracts as task lenses. Default tools permit fixes, so distinguish review-only versus remediation. Its independence is arranged by the parent, not its own prompt (`harness/pi/APPEND_SYSTEM.md:151-159`). |
| `agents/scout.md` | Compresses repository relationships into a cited handoff. Not a reviewer or implementation owner. | Keep. Exact paths/line ranges and named artifact path are valuable (`:17-29`). Generic output may need extension for validation commands and unresolved claims, as demanded by idea-to-pr. |
| `agents/researcher.md` | Focused web evidence with source evaluation and gaps. Not codebase ownership discovery. | Keep. Its tools omit bash/grep, so do not route filesystem audits here by default (`:5,19-26`). |
| `agents/planner.md` | Converts context into exact tasks, dependencies, and validation. Overlaps planning skills at execution role. | Keep. Pass a specific artifact skill contract. The generic plan template alone does not maintain plan-init's README/slice state (`:15-25,29-56`). |
| `agents/worker.md` | Single writer implements approved direction and validates it. | Keep. It can resolve architecture choices but escalates product choices (`:23,42`). Require compact evidence and do not count its own tests as independent acceptance. |

### Important contradictions

1. **Independent review launch/auth conflict:** `/improve` explicitly requires `--no-extensions` to stop fallback (`harness/pi/prompts/improve.md:30-33`). Reviewer explicitly forbids it because it removes auth and causes Anthropic failures (`agents/reviewer.md:60`). Fix the harness adapter with a tested way to preserve auth while enforcing family independence. Do not simply remove fallback protection.
2. **Planning transition authority conflict:** autopilot handoff says return without requesting approval (`idea-to-pr:90`). Focused planning requires explicit user review before follow-on (`product-review:42,48`, `program-design:41,47`, `system-architecture:40,46`, `vertical-slices:43,49`, proposal `:81`, speclist `:51`). Define pre-authorized transitions at the coordinator boundary while keeping every leaf planning-only.
3. **Authoring contract drift:** make-agent prescribes Claude-style frontmatter and `inherit|sonnet|haiku|opus`. Existing profiles use provider-qualified Pi models, lowercase tools, Pi-specific lifecycle keys, and descriptions without `Delegate when ...` (`.agents/skills/make-agent/SKILL.md:27-40`, current `agents/*.md:1-10`). Treat profiles as Pi adapters or update the authoring contract intentionally. Do not blindly normalize them and break runtime.
4. **Portable/harness mismatch:** PR review hardcodes `subagent` even though OMP routes through `task` (`review.md:40,49`, `harness/omp/APPEND_SYSTEM.md:16-20`). Generic workflow skills already forbid prescribing tool/agent/model APIs (`idea-to-pr:14,122`, `flow-design:63`).

## Phantom names, missing artifacts, and knowledge integrity

Confirmed from current files, not historical usage:

- `AGENTS.md:62` names nonexistent `agents/code-reviewer.md` as the example. The real profile is `agents/reviewer.md`. This is a stale authoring pointer.
- No standalone `review`, `plan-review`, or `pr-review` skill exists in the current skill tree. `/pr review` is an action under pr. `reviewer` is an agent. Do not invent per-perspective profiles: PR review explicitly says none exist (`skills/dev/pr/references/review.md:40`).
- `pr-monitor` in `skills/dev/pr/references/monitor.md:5` is a legacy internal name. Dispatch maps the actual command `/pr monitor` at `skills/dev/pr/SKILL.md:23`. It is not proof that a separate installed skill is missing.
- `fresh-air/REFERENCE.md:47-49` refresh commands point at absent `skills/code-quality/_knowledge/...`. Runtime local datasets exist. The refresh source is missing, not the operational smell/technique corpus.
- `install.sh:24` references absent `harness/omp/plugins/pi-intercom.txt`. The directory currently contains only pi-jev.txt. The OMP managed-artifact table likewise lists only pi-jev (`harness/omp/README.md:8-12`). Inspect installer missing-manifest behavior before changing this route. Do not claim the plugin is installed from that nonexistent file.
- `skills/dev/pr/references/stack.md:13-15` names `references/cli.md`, `references/rest-api.md`, and `references/workflows.md`. Actual companion filenames found under the PR reference directory use `stack-` prefixes. This is outside review logic but can break planning/shipping handoffs that use stacks. Confirm and correct these pointers during the relevant migration, not by adding phantom skills.
- Root README's `[Pi agent profiles](#pi-agent-profiles)` link (`README.md:155-156`) points to no root heading. The section exists in `harness/pi/README.md`. Use the cross-document link.
- All 26 audited skill entrypoints have catalog names/paths. A targeted local markdown-link existence scan found no broken real entrypoint link. Plan-init placeholder links were excluded as template examples, not missing files.

Dataset inspection:
- sniff, fresh-air, and refactor smell indexes are byte-identical: 23 smells, five categories, SHA-256 prefix `97755556ed54`.
- fresh-air/refactor technique indexes are byte-identical: 66 techniques, six families, prefix `036316bfd6cc`.
- sniff has 23 smell articles. Fresh-air has 66 technique articles. Fresh-air/refactor intentionally retain metadata without smell articles. Refactor intentionally lacks technique articles (`refactor/REFERENCE.md:57-60`). Do not flag those as missing blindly.
- principles has 18 entries in four categories. Its SKILL requires full hierarchy traversal (`principles/SKILL.md:29-35`).
- Consolidating duplicate index storage can help, but flat installation links entire skill directories. A new shared directory must remain reachable after installation. Do not move knowledge to an uninstalled sibling without adapting references and packaging.

## Catalog, install, and authoring requirements

- Artifact identity comes from `name:`. Skill directory/name must match, and agents must remain unique (`AGENTS.md:45-48`, make-skill contract, make-agent contract).
- Global skills remain repository-agnostic. Repo-local authoring helpers remain under `.agents/skills`. Harness adapters/config belong under `harness/` (`AGENTS.md:24-29`).
- Add/rename/remove requires matching README catalog edits in the same change (`AGENTS.md:69-82`). Managed harness add/remove/rename also requires its harness README table (`:84-86`).
- Default commit granularity is one skill per commit. Lock-step coupled contracts may ship atomically with explanation (`AGENTS.md:88-94`). This matters for renaming a review skill and its caller together.
- `install.sh:28-51` reads frontmatter names and links directories/profiles. Existing artifact types need no new installer case. Rename path and identity, reinstall, and inspect stale links (`AGENTS.md:65-67`).
- Installer automatically removes dangling links (`install.sh:527-530`). It does not remove still-valid legacy links that point to a retained compatibility wrapper. Plan that explicitly.
- Config is copied, not linked, and managed local changes are overwritten (`install.sh:54-78`, `harness/omp/README.md:14-18`). Do not fix runtime-only prompts or installed profiles.
- Third-party Pi changes require versioned patches plus idempotent installer work. Test pristine install twice and document managed artifacts (`AGENTS.md:97-109`).
- Authoring requires an active guardrail in every planning-only skill, not merely a reference to another skill. It must prohibit source edits/follow-on invocation and stop for review (`.agents/skills/make-skill/SKILL.md`, paragraph after default section order). Refactor/extract need stronger explicit boundaries if retained as planners.
- Deep-review lacks `user-invocable` and sets `disable-model-invocation: true` (`:1-5`). This explains explicit-invocation-only metadata. It does not make it a phantom merely because it is absent from some auto-discovered skill lists.

Catalog drift:
- All ten code-quality descriptions differ from the frontmatter text (`README.md:132-141` versus each SKILL's `description`). Principles is described as concise although its contract is exhaustive.
- Scope, speclist, context-engineering, and reflect also use rewritten catalog descriptions (`README.md:69,87-89`). Exact policy compliance requires aligning them to frontmatter in a touched-skill migration.
- README calls agent profiles Claude Code subagents (`README.md:8`) while Pi README explains their Pi-specific runtime keys. Correct the boundary rather than claiming full profile portability.

## Existing .plans conventions

The repository uses `.plans/<slug>/README.md`, optional proposal/discovery/QA artifacts, and `specs/NN-*.md`. `.gitignore` does not exclude `.plans`.

- `.plans/native-gh-media-attachments/README.md:1-16` has status/summary, Design, Slices, PR link, and Decision log. It includes discovery.md and qa.md beside proposal/specs.
- Its Decision log records role ownership, independent review, retry, QA, and final audit (`:22-32`). These are current artifact examples, not invocation-frequency evidence.
- `.plans/setup-jev-ultrafast/README.md:1-20` uses the same index, one slice, and a merged PR.
- `.plans/setup-jev-ultrafast/specs/01-add-jev-ultrafast-skill.md:7-21` separates `## Implementation` and `## Test Scenarios`. This illustrates the two-section schema required by idea-to-pr but not yet required directly by speclist.
- Canonical contract: `skills/planning/plan-init/SKILL.md:42-74`. Owners update only their sections/rows. Decisions append. Build owns shipping status. A review-process plan should use this existing location and structure after planning is authorized. This audit did not create it.

## Validation commands and coverage

Executed read-only checks:
- `bash -n install.sh` — passed.
- `git diff --check` — passed.
- `git status --short` — empty. No repository edits.
- Python JSON parsing/counts/hashes of code-quality indexes — passed.
- Targeted local markdown-link checks on audited SKILL entrypoints and catalogs — no broken real entrypoint links. Placeholder examples need template-aware validation.

Available checks for implementation, not run here:

```sh
bash harness/pi/tests/package-patches.test.sh
bash harness/pi/tests/pi-improve.test.sh
node harness/pi/tests/package-extensions.test.mjs <Pi-SDK-package-directory> <Pi-agent-directory>
bash -n install.sh
node --check harness/pi/bin/pi-improve
```

The first two test suites write sandbox state. They were not run because this task permits writes only to the named report/inventory. The extension test requires installed packages. No dependencies were installed.

Evidence: `harness/pi/tests/package-patches.test.sh:2-9` defines isolated offline patch tests. `pi-improve.test.sh:2-4,17-26` defines isolated plumbing/static tests. `package-extensions.test.mjs:1-8` specifies SDK/agent arguments. Harness README documents coverage at `harness/pi/README.md:16-17,91`.

Recommended new validation cases for the later plan:
1. Explicit file scope, uncommitted scope, committed branch scope, stale local base, fork PR, and differing local/remote head.
2. Read-only review cannot edit, commit, push, publish comments, or tick implementation checkboxes.
3. Fix/comment modes enforce ownership and head immutability.
4. Small inline review, three-perspective review, missing reviewer, synthesis duplicates, and evidence gaps.
5. Family routing after provider fallback, mixed-family production, unavailable independent family, and auth-preserving headless review.
6. Planning-only skills return artifacts without implementation. Authorized autopilot transitions do not erase leaf boundaries.
7. Speclist schema matches build/QA ownership. QA evidence is separate from unit-test assertions.
8. Frontmatter identity, catalog description/path equality, missing named references, shared knowledge resolvability, and retired symlink cleanup.
9. Sandboxed installer twice. Never use the real home. Preserve unrelated files and verify copied managed config.

No dedicated portable review-contract test suite was found in the targeted directories. Existing harness tests cover plumbing, not the complete review workflow.

## Portable versus harness boundary

Keep in portable skills:
- Comparison identity, scope, non-goals, findings schema, severity/confidence, evidence rules.
- Responsibilities, acceptance criteria, runtime QA, read-only/remediation modes, artifact/checklist ownership.
- Planning-only authority and caller handoff contracts.

Keep in harness adapters:
- `subagent` versus OMP `task`, exact agent profiles, model/provider names, fallback/auth handling.
- Session/log paths and model-provenance extraction details.
- Standalone Pi/Orca ownership handoff and process cleanup.
- Installer destinations, package patches, and machine-local configuration.

Keep GitHub-specific behavior in the PR adapter:
- PR OIDs, fork fetch/worktree handling, review/comment APIs, disclosure, mutation authorization, and same-head publication gates.

Do not put a new mandatory review platform in every specialist skill. A portable review contract can accept a lens and return findings. The active harness chooses how to execute and verify it.

## Start Here

Open `skills/dev/pr/references/review.md:5-51` first. It is the strongest concrete review entrypoint and exposes scope, topology, and portability problems together.

Then compare `skills/workflow/idea-to-pr/SKILL.md:85-118` with `harness/pi/APPEND_SYSTEM.md:121-169`. These define acceptance ownership and the stronger Pi independence rule.

Planning decisions still needed:
- Confirm the two proposed public-skill merges and whether compatibility aliases are wanted.
- Choose one finding/return contract without flattening specialist knowledge or runtime QA.
- Decide the exact pre-authorization rule for autopilot planning transitions.
- Choose an auth-preserving mechanism that enforces independent-family review.

No source implementation, historical invocation research, or subagent dispatch occurred.
