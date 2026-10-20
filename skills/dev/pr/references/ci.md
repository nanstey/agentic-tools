# PR CI

## Core Contract

Investigate and fix failed CI for the current branch PR end-to-end.
Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict.
Default flow includes fix, validation, commit, and push unless user scopes it down. Load [`gates.md`](gates.md); inherit its packet/findings and three-round state for every changed fix head. Source reviewers do not run CI/tests; separate validators execute checks.

## Required Inputs

1. Current branch.
2. Matching PR.
3. Requested scope (full flow or investigation only).
4. Current outcome/check evidence and caller-owned round state; honor deferred commit/push when monitor batches remediation.

## Workflow

1. Resolve PR via `/pr info`.
2. Discover expected required checks and dependencies below, then read failed completed checks/runs (`gh pr checks`, `gh run view --log`) for the authoritative base/head/policy.
3. Group failures by root cause; keep evidence per group and stable finding IDs. Classify as real code issue, already fixed, flaky, external, or unclear; do not fabricate fixes for external/flaky failures.
4. For code remediation, verify viewer ownership, non-fork pushable source branch/repository, matching branch and authoritative `HEAD`, clean working tree, authorization, and a reserved next review round before edits. During a monitor batch, only tracked batch changes are permitted; any unexpected change stops. Fix verified requests only, with minimal scope; optional nits require separate explicit selection/authorization and never drive rounds.
5. Separate validators recheck acceptance outcomes and touched-area lint/typecheck/tests. Publish only changed code with passing validation through `/pr push`; honor caller-deferred commit/publication.
6. Every published fix head consumes the reserved next round. Return updated evidence/state and repeat affected outcome/required-CI/quality/security gates before readiness; use the shared source packet, not a nested lifecycle or reset review loop. Monitor owns this continuation when called from monitor; a standalone CI run must obtain the affected review coverage before reporting gate completion.
7. Report rerun guidance, remaining expected jobs, review coverage, and unresolved blockers. Failed checks or material evidence gaps do not permit readiness.

Stop as blocked on risky architecture/product decisions or ambiguous trade-offs; report the options and do not choose.

## Expected Required Checks

Use this discovery for lifecycle, review/fix, monitor, ready, and merge. `gh pr checks <number> --required` reports observed jobs, not proof of the complete expected set.

1. Pin authoritative base/head and trusted policy. Read applicable repository instructions, branch protection and rulesets (for example `gh api repos/{owner}/{repo}/branches/{base}/protection` and `gh api repos/{owner}/{repo}/rules/branches/{base}`), required checks/workflows, and workflow definitions at the trusted revision where permissions allow. Include required external checks, matrix/reusable workflows, event/path conditions, and documented merge-queue requirements; do not let PR changes weaken the policy used to review them.
2. Record each expected job, policy source, applicable event/condition, dependency, gate stage, current-head result, and missing evidence. Classify independent jobs, automated-review-dependent jobs, required human-approval jobs, and later merge-queue/release jobs to avoid circular prerequisites. Jobs at later human/queue/release gates are recorded as not yet due until their prerequisites, not skipped/passed or required before readiness; they must pass at their actual gate. Human approval/queue/release gates are not waived or self-granted by readiness.
3. Run independent required CI after outcome evidence and before quality/security gates. Automated-review-dependent jobs run after their actual prerequisites. For ready-only required jobs, use a supported draft/manual trigger or a configuration change only within explicit permissions; otherwise report blocked with the needed trigger/configuration. Never use readiness to start them or call them passed/skipped.
4. Match expected jobs against status/check runs (`gh pr checks --required`, `gh pr view --json statusCheckRollup`, `gh run list --commit <headRefOid>`, and job details/logs as needed). Surround snapshots with `/pr info` and require unchanged base/head/policy. For obligations due at the current gate, missing expected jobs are incomplete, queued/running jobs pending, and failed/cancelled/timed-out/action-required jobs failing. Skipped/neutral results satisfy a required obligation only when trusted policy proves them valid for this change; terminal alone is insufficient.
5. Zero observed checks never passes by itself. Record explicit `not applicable` only when trusted policy and applicable branch rules/workflows verify that no checks are expected for this change. Empty rollups, no workflow directory, or a 404 alone cannot prove that external/ruleset checks do not exist. Unavailable permissions, pagination, API/auth/rate-limit errors, unknown policy, or missing required evidence mean incomplete/blocked, not no CI.

## Safety Rules

- Never assume the current branch has a unique open PR; discover and verify it.
- Never rely only on check summaries when logs are available.
- Never treat duplicate failed jobs as separate root causes without evidence.
- Never create an empty commit to mark CI progress.
- Never push if validation is failing.
- Never force-push unless explicitly requested.
- Never overwrite or revert unrelated user changes.
- Never fabricate code changes for flaky or infrastructure failures.
- If unexpected changes appear while working, stop as blocked and report the unexpected changes.

## Output Style

Report authoritative base/head/policy, expected-job/dependency inventory and evidence, failed jobs/root causes, fixes vs already-fixed/flaky/external issues, validator outcomes, commit/push or deferred-publication status, inherited round/packet updates, and the exact missing check/review/trigger or blocker.
