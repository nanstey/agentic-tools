# PR ready

Convert a draft PR to ready only after current gates pass. See [lifecycle](lifecycle.md) and [policy](policy.md#required-checks).

## Inputs

- PR target, active run id, current evidence, and optional `force`.

## Steps

1. Resolve with `pr snapshot [target]` and verify one open PR.
2. Check evidence identity against the current base, head, and policy. Run any missing phase now within the active run's budget.
3. Confirm outcome, expected checks, quality/security coverage, requests, and threads. Use `pr checks inventory` and `pr threads` for evidence. Apply [force policy](policy.md#force) when requested.
4. Run `gh pr ready <number>`, then re-read with `pr snapshot [target]`; require ready state and unchanged base/head.

## Output

Report PR state, current evidence, gaps or overrides, and run id. Do not claim approval or merge permission.
