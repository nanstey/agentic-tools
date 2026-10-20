# Unified review proposal

Keep `/deep-review` and `/extract`. Share evidence-led impact analysis and advisory Jev judgments through read-only `risk-review`, with bounded PR quality/security loops.

**Status: approved for implementation in one PR.** See the build checklist for progress.

## Commands and boundaries

| Route | Preserved method |
| --- | --- |
| `/refactor inspect` | `sniff` diagnosis |
| `/refactor extract` | `/extract` alias: DRY/SRP placement planning |
| `/refactor simplify` | `ponytail lite`: report before authorized edits |
| `/refactor plan` | `fresh-air` and refactor planning |

Keep `/refactor` thin. Preserve manual DRY/SRP/principles lenses, specialist prompts, reports, and datasets. `/extract` retains same-file/existing-file/new-file destinations, concrete paths, and rationale. `/deep-review` retains layer placement, type/boundary contracts, branching, indirection, decomposition, and maintainability checks.

Separate review context and optional model diversity remain. Unknown model provenance never blocks. Main-model routing stays unchanged. Select specialist work explicitly, without automatic fanout or editing.

## Evidence-led impact assessment

ISTQB describes change impact analysis. This workflow is our proposed adaptation, without numerical risk tiers. Sizes measure workload only, never safety or reach.

1. Record scope, base/head, trusted policy identity, acceptance criteria, and observed outcome. Review policy changes under trusted prior policy.
2. Read changed behavior, symbols, defaults, contracts, schemas, and permissions on both revisions. Trace callers/entrypoints, API/event/external consumers, shared state/dependencies/resources, execution/tool authority, and deployment/trust/data boundaries. Record cited paths and containment stopping points: `changed default → shared client → services A/B → all tenants`. Mark assumptions and unknown edges. Existing searches, repository docs, and tests suffice.
3. Separate reach, safety/security/data/compatibility/operational consequences, containment/recovery, and uncertainty. Tests support specific claims, never invented coverage. Flags cannot undo writes or external effects. Static references miss runtime configuration, dynamic dispatch, plugins, and external consumers. Absence of search hits never proves complete transitive coverage.

Inventory binaries, submodules, generated files, renames, and dependencies. Prove source correspondence and effects before narrowing a huge generated diff. Recover missing/truncated content or record a coverage gap. Material gaps require inspection or owner evidence, never assumed safety.

| Effect/boundary | Required checks/expertise |
| --- | --- |
| Every change | Source scope, behavior correctness, tests, security triage |
| Fully traced local effects | Narrower context only with containment evidence |
| Public/consumer contracts | Compatibility/integration checks |
| Auth/session/crypto/secrets, trust, safeguards, execution/tool permissions | Deeper security review |
| Persisted data/irreversible effects | Migration, restore/recovery checks |
| Deployment/infrastructure/dependencies/build/release/CI policy | Rollout, coupling, operational checks |
| Structural changes | `/deep-review` |

Deleted/weakened safeguards require test-adequacy work. Required coverage follows effects, consequences, and uncertainty, not paths alone. Reviewer counts/concurrency follow workload and cannot reduce coverage.

## Jev judgments and deterministic handling

The coordinator/reader builds structured state: base/head/policy, acceptance/outcome, changed behavior, exact base/head snippets, candidate impact paths with evidence IDs, named consumers/state/boundaries, test/containment/recovery evidence, and explicit gaps. It checks locations and snapshot identities. Jev evaluates supplied state only. It neither discovers dependencies nor generates graphs, narratives, or source references. Untrusted PR content cannot redefine questions or gates.

| Stage/input | Complete judgment and handling |
| --- | --- |
| Impact packet | Choice per propagation/containment claim: “Does the supplied evidence support this claim?” `supported`: evidence establishes it. `contradicted`: evidence conflicts. `insufficient`: neither conclusion follows. A supported relation never guarantees coverage. |
| Same packet | Noul per relevant domain: “Do the supplied changes require deeper {domain} review?” Instantiate security (trust/secrets/authority), data (persistence/recovery), contract (consumer compatibility), deployment (rollout/resources/CI), and structure (placement/boundaries). Yes: changed effects or material uncertainty require scrutiny. No: evidence establishes nonapplicability. Multiple domains can apply. |
| Later source-backed candidate findings | Separate adequacy Noul: “Does supplied source/baseline/obligation evidence permit classification?” Yes requires source facts and category-relevant provenance, materiality, and obligations. Missing necessary baseline or other material evidence means no. Independently ask Choice: “Which defined category fits this candidate finding?” Use the definitions below. Ignore category until adequacy passes. The coordinator checks adequacy during the pilot. Source verification and deterministic safety rules precede final category/gate. |

Batch independent questions over the same state. They cannot see each other's outputs. Instructions contain complete meaning because IDs are invisible. A later request requires new evidence/findings, never dependencies on same-batch answers.

Code unions mandatory domains from policy/known sensitive effects with Jev suggestions. Jev can add scrutiny, never cancel obligations. Low Choice confidence, ambiguous Noul probability, disagreement, or incomplete source routes to inspection/owner review. Noul returns yes probability, no separate confidence. Near 0.5 means uncertainty, not moderate impact. Choice returns selection, probabilities, and confidence. Confidence describes distribution concentration, never truth or permission.

Retain raw answers/distributions, confidence where applicable, model/question/policy versions, and evidence snapshot for replay. Pilot judgments stay advisory: no reduced coverage, dismissed/materially downgraded requests, clean/ready declarations, or edit/commit authorization. A later explicit policy could automate low-stakes routing only after labeled fixtures justify decision thresholds. No weighted risk score or copied sample cutoffs.

Unavailable/malformed/errors use conservative source assessment or explicit incomplete, never clean or deadlock solely on Jev. No blind retries or same-head recategorization for preferred answers. No new runner, SDK, service, or graph platform.

## Finding categories

Categories differ from severity/impact and evidence confidence.

| Category | Complete definition |
| --- | --- |
| `request` | Source-verified defect introduced/materially worsened by PR, or material unmet acceptance/safety/contract obligation applicable to the change. Finding-based blocker regardless of remediation size. |
| `nit` | Optional/preference/minor improvement. Nonblocking, no compulsory fixes or rounds. |
| `existing` | Baseline proves predating PR without material worsening. Nonblocking, separate followup. |

New exposure/aggravation remains `request`. Uncertain baseline is a coverage gap, never `existing`.

Expensive requests need narrower fix, split, or revert options. Product/risky scope decisions stop blocked. Broad unrelated redesign/cleanup goes to followup. Escalate critical existing issues separately. Only explicit applicable policy can independently gate them. Report requests first, nits/existing separately.

## PR gates and bounded loops

```text
Outcome → Required CI independent of review → Quality → Security
→ Automated-review-dependent required CI → Human readiness
Later: Human approval → Merge queue → Release flag/rollback policy
```

Require observed acceptance outcomes, not green CI alone. Failed prerequisites stop downstream gates. Quality checks behavior/tests/contracts/structure. Every PR receives security triage and relevant deeper security review before readiness. Escalate critical new risks immediately.

Share **three review/fix rounds including initial review** across quality/security. Both clean visits fit round 1. Each changed head consumes the next round. Never author an unreviewable fix head. No budget reset, nested loop, or recursive `/pr review`.

Quality fixes require outcome/CI revalidation and review of delta/affected paths. Security fixes also repeat affected quality/security. Changed heads require reassessing changed impact and affected prior paths/checks, retaining applicable findings and IDs/root causes. Reuse matching evidence only. Base/policy changes invalidate freshness and require full reassessment when broad. Either base/head changing invalidates readiness/approval.

Unfixable/no-progress requests, exhausted budget, failed reviewers/checks, or material evidence gaps stop blocked with next action. Plain/comment modes report unresolved requests as `changes_required`. Convergence requires no unresolved verified requests and complete current evidence. Do not repeat resolved/dismissed findings without new evidence.

## Workflow changes

Paths below are relative to `skills/`. This plan names intended locations only.

| Location | Shared responsibility |
| --- | --- |
| `code-quality/risk-review/SKILL.md` | Impact packet, Jev rubrics, source verification/deduplication, findings/checks/verdict |
| `dev/pr/{SKILL.md,references/review.md}` | `/pr review [target] [fix\|comment]` → `risk-review`, authoritative base/head, ownership, and permissions |
| `dev/pr/references/lifecycle.md` | Replace once-per-head/no-fix-rereview exception with shared loop |
| `dev/pr/references/{ci,monitor,ready}.md` | Expected checks, prerequisites, freshness/readiness |
| `workflow/{build,idea-to-pr}/SKILL.md` | Supply outcome evidence, reuse matching packet, avoid duplicate full reviews. Runtime validators remain separate. |

Default `/pr review` reports only, without edits. Own-PR `fix` addresses verified requests only under existing authorization/clean-branch checks, with validation, safe commits/pushes, and re-review. Nits require separate explicit selection/authorization, never drive rounds. Other-PR `comment` posts verified same-head findings with disclosures, never edits or approves. Standalone review cannot certify readiness without prerequisites.

Source reviewers neither test nor edit. Check candidates against source, with a separate verifier when needed. Deduplicate mechanisms. Authorized implementers fix. Separate validators test. Monitor owns health/CI/threads without duplicate review or recursion. Remote/comment fixes repeat affected gates under inherited budget.

Never infer CI pass from no checks. Review-dependent jobs follow prerequisites. Ready-only checks need supported draft/manual triggers or configuration changes, otherwise blocked. `/pr ready` needs current outcome/CI/quality/security evidence and resolved automated-review-dependent jobs. Readiness grants no merge authority.

## Rollout and planned proof

Sequence: shared impact/Jev contract → refactor routes → PR gates/loop fixtures → advisory pilot measuring defects, noise, rounds, and human effort.

Planned fixtures pair small-but-broad permission/shared-default changes with large-proven-isolated changes. Include missed external consumers, contradictory containment, dynamic unknowns, multiple domains, and uncertain baseline. Also include adversarial instructions, unavailable/malformed Jev, false-high-confidence, and stale heads. Assert Jev cannot cancel mandatory checks, downgrade requests, or authorize fixes.

Retain category/expensive-request/nit-round tests, shared cap, fix re-review, security return to quality, and nonediting modes. Keep CI order/ready-only triggers, failed outcomes despite green CI, unknown provenance, manual lenses, and `/extract`/`deep-review` access. Runtime Jev calibration is not done or claimed.

## Sources

[Audits](evidence/skill-audit.md) · [Usage/limits](evidence/usage-audit.md) · [Anthropic distinctions](evidence/anthropic-review.md) · [Earlier checks](evidence/verification.md) · [ISTQB impact analysis, §2.2.3](https://istqb.org/?sdm_process_download=1&download_id=3345) · TypeSafe: [state](https://docs.typesafe.ai/concepts/state), [Choice](https://docs.typesafe.ai/primitives/choice), [Noul](https://docs.typesafe.ai/primitives/noul), [confidence](https://docs.typesafe.ai/confidence)
