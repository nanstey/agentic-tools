# PR push

Publish one validated change batch to its existing PR. See [policy](policy.md#draft-before-changes) and [policy](policy.md#force-push).

## Inputs

- PR target, active run id, validated changes and results, and optional publication deferral.

## Steps

1. Resolve with `pr snapshot [target]`. `pr push` runs the guard itself and allows local commits on top of the PR head; do not run the strict `pr guard` on an unpushed or dirty tree.
2. If publication is deferred, return the batch without committing or pushing.
3. Before any push path, including after rebase, restack, or stack changes, ensure the PR is draft or `drafted_for_changes` is recorded for this run. Run `pr draft [target] --run <id>` when needed.
4. Commit the validated logical group with finding IDs in the commit message. Do not create an empty commit or include unrelated changes.
5. Publish only that batch with `pr push [target] --run <id> [--force-with-lease]`.
6. Re-resolve with `pr snapshot [target]`; run `/pr description` once for a new head.

## Output

Report PR, before/after base and head, published commits, invalidated evidence, run id, and description result.
