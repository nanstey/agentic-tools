# Unified-review advisory pilot

## Purpose and boundary

Run the fixture cases as an advisory review protocol. The pilot tests whether reviewers can apply the documented evidence and gate contract; it does not calibrate Jev, authorize a new autonomous action, change mandatory coverage, or establish numeric probability thresholds.

A source reviewer reads source and reports. A separate validator may supply test, outcome, and CI evidence. An authorized implementer owns any fix. The coordinator owns the snapshot, round state, publication, readiness, and any decision to stop. No pilot result authorizes edits, commits, pushes, comments, approvals, readiness changes, or check skipping.

Unknown provenance is recorded as a limitation, not a blocker. Static checks and fixture replay do not prove agent execution, harness tool enforcement, complete dynamic discovery, or external-consumer coverage.

## Protocol

1. Select a fixture from [`tests/fixtures.json`](tests/fixtures.json). Treat its `input` and `evidence` as a supplied packet fragment, not as a claim about a live PR or model result.
2. Record immutable base/head, trusted policy identity/digest, fixture version, source artifact revision, reviewer/model/adapter identity if known, and evidence IDs. Review changed policy under trusted prior policy.
3. Have the coordinator construct the supplied-state packet. Source reviewers inspect the cited source and report impact paths, containment, uncertainty, selected checks, gaps, and source-verified findings. They do not execute validation.
4. Ask only the complete question objects in `skills/code-quality/risk-review/references/questions.json`. The reference TypeSafe shape uses `type: "noul"`; an existing codemode boolean adapter may translate it to `type: "bool"` while preserving the instructions and true/false criteria. Record the adapter shape used.
5. Batch independent claim and per-domain questions over the same state. Question IDs correlate returned answers only: Jev does not see them, so the instructions carry complete domain/claim meaning. Later adequacy/category questions use newly source-backed candidate-finding evidence; neither question depends on another answer in its batch.
6. Validate response structure, request/snapshot correspondence, expected IDs, types/options, finite probabilities, complete Choice distributions, and adapter-provided confidence. Retain unavailable, malformed, or error responses as diagnostic evidence. Do not blindly retry or rerun unchanged state to obtain a preferred answer.
7. Apply deterministic policy and source rules before advisory output: union policy/effect checks with added Jev suggestions; never let Jev remove a check, dismiss or downgrade a verified request, declare clean/ready, or authorize a mutation. Use conservative source assessment or record `incomplete` when material evidence is missing.
8. For a PR-loop case, record the inherited shared limit/current round and snapshot. Quality and security clean visits share initial round 1; each changed fix head consumes a later round. Remote comments, CI updates, monitor activity, base/head/policy changes, and resumption do not reset the budget.
9. Record the coordinator disposition and human review result. Do not convert a fixture expectation into an observed pass merely because a model answered it.

## Case set

Run positive and adversarial cases from the fixture file; retain the case ID and evidence IDs in each record.

- **Positive:** small shared permission/default, large proven-isolated change, multiple domains, expensive verified request, unchanged existing and optional nit, default/comment modes, shared initial round, quality/security fix paths, and trusted-policy proof that no CI is expected.
- **Adversarial:** external/dynamic unknowns, contradictory containment, uncertain baseline, new exposure through old code, PR-supplied policy, unavailable/malformed or high-confidence Jev, stale base/head/policy, unauthorized nit selection, exhausted round budget, remote/monitor reset attempts, failed outcome with green CI, empty observed checks, and ready-only jobs without a supported trigger.

The 26-case fixture set remains expectation-only. Its static tests neither contact an API nor install an SDK.

## Recorded live smoke checks

[Raw requests, responses, and coordinator decisions](evidence/jev-smoke.json) record five separate synthetic Jev cases through the existing classifier adapter.
Four expected Choice labels matched. The fifth case had inadequate baseline evidence, so the coordinator discarded its forced `existing` category.
The large-artifact case supported only bounded containment. Its missing corpus still prevented complete review.
Noul probabilities remain observations. No probability threshold or automatic routing policy applies.
These checks do not calibrate production accuracy or prove fixture execution, tool restrictions, or the complete PR lifecycle.

## Source and evidence record

For each replay, fill this record without inventing values:

| Field | Value |
| --- | --- |
| Fixture ID/version | |
| Base/head and trusted policy identity/digest | |
| Source contract revision/paths | |
| Evidence IDs and immutable artifact locations | |
| Reviewer context and provenance (or `unknown`) | |
| Jev model/adapter/version (or `not used`/`unavailable`) | |
| Reference question version and adapter shape | |
| Validator command/environment/snapshot, if separately run | |
| Raw Jev response/error artifact location, if any | |
| Coordinator disposition and source citations | |
| Human adjudication and unresolved unknowns | |

Retain raw questions/state or immutable identities, distributions, confidence when applicable, errors, policy/evidence versions, and replay limitations. Redact secrets without concealing a material gap.

## Measures and baseline template

Compare the advisory treatment with a documented baseline review method on comparable labeled cases. Record counts and effort only after observation; leave unavailable fields blank. Do not infer effectiveness from confidence or fabricate a pass count.

| Measure | Baseline | Advisory treatment | Notes/evidence |
| --- | --- | --- | --- |
| Verified introduced/worsened defects found | | | Case IDs, source citations, human adjudication |
| Verified defects missed | | | Later discovery or adjudication; distinguish unknowns |
| Clean changes correctly kept clean | | | Complete coverage and no verified request |
| Noise (unverified candidates, nits, unchanged existing) | | | Categories kept separate from requests |
| Shared rounds consumed / exhausted | | | Initial quality/security sharing and changed heads |
| Human effort | | | People/roles, elapsed active review time, rework; no inferred cost |
| Material coverage gaps | | | Dynamic/external/baseline/policy/CI limits |
| Jev availability or malformed responses | | | Diagnostic only; no retry count target |

## Interpretation

Review disagreements against source and trusted policy. Classify a miss as missing evidence, source-analysis error, question ambiguity, model error, adapter/response failure, or policy/composition error. Preserve unresolved unknowns. Any future automation requires a separate explicit policy and labeled evidence; this pilot creates neither automatic routing nor a numeric cutoff.
