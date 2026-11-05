# Review provenance and publication policy

## Purpose

A PR review fell back to one direct reviewer and published a `Limits:` footer that exposed coordinator state. The target behaviour is to install and discover reviewer profiles reliably, review third-party code with more than one model family, and keep operational limitations in the local report rather than public PR text.

**Verified root cause.** The repository has 24 Lite profiles under `agents/`, including all reviewer tiers. `install/main.sh` routes Pi through `install_pi_agents`, and `install/modules/artifacts.sh` copies every profile as a regular file. The offline package-patch test verifies a first install copies 24 profiles and a second install is idempotent. In the affected runtime, `~/.pi/agent/agents` contained no profile files, and dispatching `scout-high` and `planner-high` returned `Unknown agent type`. The active Agent tool consequently exposed only its generic types. This is stale or missing local installation before session start, not an installer implementation defect. Rerun `install.sh` and start a new Pi session to make the profiles discoverable.

The selected path keeps the existing profile names and installer. It changes policy so third-party review assigns work to both reviewer model families without inferring the PR author's model. Cross-family checking remains only for work demonstrably produced by the current agent session. It also makes the public/private boundary explicit.

## User story and scenarios

- As a contributor whose PR is reviewed by an agent, I receive findings, evidence, and requested changes only. I do not receive agent dispatch or environment notes.
- As a review coordinator of third-party code, I dispatch source review across the Anthropic and OpenAI reviewer families in parallel and merge duplicate findings.
- As a coordinator reviewing code produced by the current session, I choose the opposite reviewer family only for that cross-family verification.
- As a coordinator with unavailable reviewer types, I report the limitation locally, try only safely constrained read-only fallback reviewers, or return the established blocked result. I never publish the limitation.

## Behaviour

### Third-party review

Given a PR or code scope not positively identified as current-session output, when `review-code` runs, then it treats the scope as third-party by default. It assigns required source-review work across both reviewer families in parallel, records task completion locally, and merges/deduplicates findings. Unknown author or completion model provenance does not make third-party review incomplete.

### Current-session output

Given work positively identified as produced by the current session, when the coordinator verifies it, then the opposite reviewer family verifies the work. Missing final-model evidence affects only that own-work cross-family claim and remains local.

### Public review text

Given `/pr review … comment` posts a review, when it writes inline comments or the review body, then each item contains only the source-verified finding, evidence, and requested change. It excludes dispatch details, agents, models, tiers, reviewer counts, validator/verifier status, coverage or `Limits:` notes, provenance, session or tooling availability, and local-checkout statements.

### Reviewer fallback

Given a required reviewer type is unavailable, when the coordinator has multiple safely read-only generic reviewers, then it may dispatch them in parallel as a best-effort local fallback and tell the user that configured reviewer coverage was unavailable. Otherwise it returns `blocked: needs a coordinator with Agent-tool dispatch`. Neither path adds an operational footer to a PR comment.

## QA

- Run `bash install/tests/install.test.sh`.
- Run `bash harness/pi/tests/package-patches.test.sh` to verify copied regular-file agent profiles and idempotent installation.
- Run `bash install/tests/agent-drift.test.sh` to verify profile bodies, model table, and catalog descriptions remain synchronized.
- Run repository static checks if present, plus targeted `rg -i 'provenance|opposite'` and `rg -i 'Limits:|reviewer count|local checkout'` reviews. Remaining provenance references must concern source/baseline evidence or the explicit current-session verification exception.
- Inspect the final diff and PR description. The description must include the verified local-installation root cause and restart remediation. Published-review instructions must contain no coverage/footer template.

## Architecture

The review class is an explicit coordinator input: `session-produced` only with positive same-session evidence, otherwise `third-party`. This avoids inferring author model provenance from a PR author or unknown history.

The alternative is to preserve producer-family routing and treat unknown provenance as a gap. It caused the reported fallback and does not help assess third-party code, so it is rejected.

The review packet remains the local record for dispatch, validation, and gaps. Publication is a projection of verified findings, evidence, and requests, not a copy of the packet.

## Affected areas

- `skills/workflow/review-code/SKILL.md` and `references/model-provenance.md`: review classification, dispatch policy, fallback, and public-text boundary.
- `skills/code-quality/risk-review/{SKILL.md,references/packet.md}`: local coverage/model evidence semantics.
- `skills/dev/pr/{SKILL.md,references/review.md,references/gates.md,references/comments.md}`: third-party PR review, publication projection, and docs-only verifier wording.
- `agents/reviewer-*.md`, `README.md`, `harness/pi/APPEND_SYSTEM.md`, `harness/pi/README.md`, and `install/tests/agent-drift.test.sh`: neutral multi-family reviewer descriptions and synchronized runtime policy.

## Implementation phases

### Phase 1 — One lock-step review-policy and publication slice

Deliver the policy changes across review-code, PR, packet, agent, harness, catalog, and drift-test artifacts in one PR. These files must land together because any partial update would leave a caller, profile, or installed system prompt with conflicting review and publication rules.

**V&V gate:** all validation commands in QA pass, targeted searches find only intentional source/baseline provenance references and the explicit current-session exception, and the final PR description records the root cause.
