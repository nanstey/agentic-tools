# PR CI

Diagnose current-head checks and remediate verified code failures. See the decision ladder in [SKILL.md](../SKILL.md) and [policy](policy.md#required-checks).

## Inputs

- PR target, scope, active run id, current check evidence, and any caller-deferred publication.

## Steps

1. Resolve with `pr snapshot [target]`; inventory expected jobs and policy using `pr checks inventory`.
2. Rerun cancelled Actions checks once per head with `pr checks rerun-cancelled [target] --run <id>`. Treat reruns as pending. When logs are available, inspect them; never rely on summaries alone.
3. Judge expected-check policy and group failures by root cause. Verify findings before fixing; do not fabricate fixes for flaky or external failures.
4. For fixes, run `pr guard [target] --run <id>`, then apply [draft-before-changes](policy.md#draft-before-changes). Validate separately and publish through `pr push [target] --run <id>`.
5. Recheck affected evidence at the new head within the active run budget. See [round limits](policy.md#round-limit).

## Output

Report base/head/policy, expected jobs and results, root causes, reruns, validation/publication, coverage, and remaining blockers.
