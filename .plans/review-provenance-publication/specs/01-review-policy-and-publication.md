# Review policy and publication

## Objective

Make third-party reviews multi-family without producer-provenance gating, preserve cross-family verification only for current-session output, and keep all review coordination out of published PR text.

## Implementation

- [x] Confirm the root-cause evidence in the plan and prepare the same concise account for the PR description: repository profiles and installer are present; the live profile directory was empty; the active session rejected fixed tiers; rerun installation and restart Pi.
- [x] Update `review-code` and its provenance reference to classify scopes as `third-party` by default and `session-produced` only with positive evidence.
- [x] Require third-party source-review work to use both reviewer families in parallel and deduplicate results. Retain opposite-family selection only for current-session cross-family verification.
- [x] Define reviewer-type fallback: report locally, use only safely read-only parallel generic fallback reviewers when available, else return the established coordinator-dispatch blocked result. Never publish fallback state.
- [x] Update PR review, gate, comment, and local packet contracts so unknown provenance is not a third-party coverage gap and publication projects only verified findings, evidence, and requested changes.
- [x] Remove reviewer-profile and harness wording that encodes producer-opposition for third-party review. Keep model table, profiles, README catalog, and drift test synchronized.
- [x] Do not modify installer implementation because validation confirms the local-installation root cause.

## Test Scenarios

- [x] Given third-party code with unknown provenance, when the coordinator plans review, then both reviewer families are assigned in parallel and unknown provenance does not create an `incomplete` verdict.
- [x] Given current-session output, when cross-family verification is claimed, then the reviewer selection is opposite the confirmed producer family and missing proof remains local.
- [x] Given reviewer profile types are absent, when review cannot safely use generic read-only fallback, then the coordinator reports the established blocked result locally and publishes no operational text.
- [x] Given a posted review, when the body and inline comments are built, then they contain findings, evidence, and requested changes only, with no `Limits:` or coordination footer.
- [x] Given a fresh Pi installation, when `install.sh` runs twice in its sandbox, then all agent profiles are copied as regular files and the second run is idempotent.

## Validation

- `bash install/tests/install.test.sh`
- `bash harness/pi/tests/package-patches.test.sh`
- `bash install/tests/agent-drift.test.sh`
- Targeted `rg` checks specified in `proposal.md`.

## Evidence

- Root cause: the live `~/.pi/agent/agents` directory was empty and fixed-tier dispatch returned `Unknown agent type`; `install/main.sh` and `install/modules/artifacts.sh` already route Pi through regular-file profile installation.
- Static policy inspection: targeted searches found no legacy third-party provenance gate. Remaining `opposite` wording is explicitly limited to current-session work.
- Commands: `git diff --check`, `bash install/tests/agent-drift.test.sh`, `bash install/tests/skill-links.test.sh`, `bash install/tests/install.test.sh`, `bash harness/pi/tests/package-patches.test.sh`, and `bash harness/pi/tests/pi-improve.test.sh` passed.
- Limitation: fixed-tier reviewer agents are unavailable in this session, so no independent Agent QA could run. The coordinator performed the separate static acceptance pass above; configured cross-family review must run from a restarted, installed Pi session.

## Risk Controls

- Do not infer agent/session production from PR ownership or author identity.
- Do not call a generic fallback full configured coverage unless it is safely read-only and independently dispatched.
- Keep internal coverage and fallback evidence in the local packet and user report, never in GitHub text.

## Out of Scope

- Changing the installer, because current evidence shows it already copies profiles correctly.
- Changing the self-improvement loop's own-work cross-family protection.
