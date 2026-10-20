# Effect-driven source checks

Select checks from trusted policy, observed effects, consequences, and uncertainty. Record why each check applies and its evidence.
Sizes describe workload only. Reviewer count/concurrency follows workload and available expertise, never a substitute for required coverage.

| Effect or boundary | Required source checks and expertise |
| --- | --- |
| Every change | `source`: authoritative comparison, inventory, instructions and evidence integrity. `behavior`: correctness, acceptance, defaults, errors and affected paths. `tests`: adequacy and meaningful assertions, including negative/failure cases. `security_triage`: trust, authority, sensitive data, safeguards and dependencies. |
| Proven local effects | Narrow context only when cited propagation paths and containment evidence justify it. Check runtime configuration, dynamic dispatch, plugins, external consumers, and shared state before declaring isolation. |
| Auth/session/crypto/secrets, trust boundaries, execution/tool permissions, safeguards | `security`: deeper security review of authorization and misuse paths, input/output handling, isolation, secret exposure, dependencies and weakened defenses. Escalate critical new risks immediately. |
| Persisted data, schemas, writes, irreversible/external effects | `data`: migration compatibility, ordering, concurrent versions, integrity, retention, backup/restore, recovery and irreversible effects. Rollback code or flags may not undo data or external actions. |
| Public APIs/events/defaults, named downstream or external consumers | `contract`: compatibility, integration, versioning, errors, defaults, consumer assumptions and migration obligations. Read producer and consumer paths. Missing external consumer evidence remains a gap. |
| Deployment/infrastructure/resources/dependencies/build/release/CI policy | `deployment`: rollout/rollback, version skew, shared-resource coupling, availability, operational signals, failure recovery, build/supply-chain effects and expected check triggers. |
| Layer placement, branching, type/boundary contracts, indirection, decomposition | `structure`: use the preserved [deep-review method](../../refactor/references/simplify.md#structural-review). Check abstraction placement, casts/optionality, unnecessary wrappers, maintainability and simpler orchestration. Convert findings through the shared category rules, not its strict tone alone. |

Several domains can apply to one change. A tiny shared-default or permission edit can require broader review than a large proven-isolated change.
Deleted/weakened safeguards require test-adequacy work and relevant deeper security review.
Policy and known sensitive effects require checks even if Jev suggests no deeper review.
Internal [DRY](../../refactor/references/extract.md#dry-procedure), [SRP](../../refactor/references/extract.md#srp-procedure), and [principles](../../refactor/references/principles.md) methods remain available for applicable checks.
Pass `mode: report`, resolved scope/exclusions, source identity, required coverage/depth, existing findings, and SOURCE REVIEW MODE constraints to every shared method. Risk-review forbids target edits, tests/builds, and follow-on implementation; refactor's direct-invocation fix default grants this caller no new permission. Do not invoke bare `/refactor` as a substitute for selected checks.
Apply refactor's [shared finding reuse rule](../../refactor/REFERENCE.md#finding-reuse) when these lenses or extraction share findings.
Reuse matching evidence and retain stable finding IDs across methods and the review packet. Count each underlying issue once.
A smell or stylistic preference alone does not establish a blocking defect.

## Evidence and completeness

Read both revisions and enough context to support each conclusion.
Inventory renames without assuming content equivalence. Inspect submodule commits and dependency/version/lock changes for actual effects.
For generated or binary changes, establish source correspondence and generation/consumer effects before narrowing a large diff.
Recover missing/truncated content or mark the affected check incomplete. A file list is not inspected source.

Keep reach separate from consequences, containment/recovery, and uncertainty.
Cite the specific stopping condition for containment, such as an enforced isolation boundary, not a directory name or absent search hits.
Record search terms/scope and limitations. Search cannot prove full transitive coverage.
Treat contradictory containment, unknown dynamic consumers, and missing policy as reasons for inspection or owner evidence.

Review test source and consume separately produced validation artifacts. Do not execute tests/builds or claim validation you did not perform.
A passing test supports its stated behavior under its environment, not universal safety.
Record missing current outcome/CI evidence separately from source review. Material uncertainty prevents an unsupported clean result.
