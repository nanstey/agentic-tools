# PR comments

Resolve verified feedback on your branch's PR. See the decision ladder in [SKILL.md](../SKILL.md), [policy](_policy.md#findings-and-severity), and [state](_state.md#invalidation-and-reuse).

## Inputs

- PR target, active run id, current packet/findings, and caller publication or reply constraints. See [policy](_policy.md) for the shared disclosure rule.

## Steps

1. Resolve with `pr snapshot [target]`; load complete thread state using `pr threads [target]`.
2. Verify and classify feedback. For code changes, run `pr guard [target] --run <id>` and follow [draft-before-changes](_policy.md#draft-before-changes). Validate, then publish with `pr push [target] --run <id>`.
3. Commit only the validated, non-empty fix batch; include finding IDs in the commit message. Never create an empty commit. Publish with `pr push [target] --run <id>` only after validation and affected gates pass.
4. Recheck `pr threads [target]` and `pr snapshot [target]`. Reply with `pr thread reply <target> --thread <id> --body-file <file> --run <id>` and resolve with `pr thread resolve <target> --thread <id> --run <id>`. Every reply uses `pr disclosure --kind comment`. Recheck base/head and final state before replying or resolving; never resolve before publication, validation, and affected review gates pass. Leave unresolved requests and gaps open. Use `pr rerequest [target] --run <id>` for eligible reviewers. Never dismiss reviews.

## Output

Report finding/thread IDs, resolutions and replies, reviewer re-requests or skips, validation, current head, run state, and remaining gaps.
