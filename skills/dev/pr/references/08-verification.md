# PR verification

## Purpose
Verify PR claims and audit whether the body cites current evidence. Apply [policy](_policy.md).

## Inputs
- PR target; otherwise use `pr snapshot` for the current branch.
- Optional mode: `report` (default), `fix`, or `comment`.
- Matching verification result, claims, environment, and authoritative base/head.

## Evidence

Include `head: <full-oid>` in the PR body's `## Evidence` section.

## Steps
1. Run `pr snapshot [target]`; require an open PR and record base/head. `fix` requires your PR; `comment` requires another author's PR. Recheck before changes.
2. Verify claims against the authoritative comparison. Reuse matching evidence; do not rerun covered checks. Run only permitted checks, and record gaps when source is untrusted or checks are unsafe.
3. Audit each material claim against cited test/CI results and current screenshots when UI changed. Screenshots are not applicable to non-UI changes. Classify evidence `ok`, `missing`, `stale`, or `mismatch`. Overall is `verified` only when verification is achieved and no evidence gap remains.
4. In `fix` mode, update only your PR body. Preserve unrelated content and `## Evidence`; apply with `pr body --run <id> --file <path> --preserve-evidence` and verify. Never rewrite contradicted claims. Use `pr screenshots` for missing or stale UI evidence.
5. In `comment` mode, recheck the snapshot and post one same-head comment with `pr disclosure --kind comment`. Never approve or request changes.

## Output
Report PR, mode, range, claim results, description evidence status, screenshot applicability, changes or comment URL, and next action for each gap.
