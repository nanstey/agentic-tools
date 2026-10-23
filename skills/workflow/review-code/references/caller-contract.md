# Review-code caller contract

Shared by callers of `/review-code fix` (`build`, `idea-to-pr`). Callers link here instead of restating it.

## Review loop

- The caller owns `limit: 5`, initial round `1`, for its own review/fix invocation under [`gates.md`](../../../dev/pr/references/gates.md). Never reset within that invocation.
- Run `/review-code fix` on the full candidate scope: `base..HEAD` plus uncommitted changes. For local-only work, review base plus working-tree content identity. Use `plan` only if the caller forbids edits.
- Pass: acceptance criteria, scrutiny evidence, validator/QA evidence, base/head/policy/scope, prior packet and findings, and `round_state`. Reuse matching validator/QA evidence without rerunning it.
- After a fix batch, call again with the returned state for delta review, or report pending delta review. Do not nest review loops.
- If shipping was requested and no gate blocks, pass the packet, findings, and evidence to `/pr`; `/pr review fix` initializes its own per-invocation limit. Otherwise stop locally without commit, push, or PR.
- A prepublication packet is diagnostic. `/pr` reuses it only on an exact base/head/policy/scope/coverage/evidence match. If PR review-code dispatch is unavailable, it returns `blocked: needs a coordinator with subagent dispatch`.

## PR split rule

- Default: one PR across all slices in one repository.
- Split only when the user requests multiple PRs or the change spans multiple repositories. Cross-repository work uses one PR per repository, with dependencies recorded.
- Use `/pr stack` or `/pr restack` only for user-requested dependent PRs in one repository. Never infer a split from slice count, size, or dependency order.
