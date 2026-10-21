# PR Push

## Core Contract

Single publication path for changes to an existing PR branch: commit validated changes, push them, then run the head-change side effects in one place. Does not validate, review, or remediate. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Default tool is `gh`.

## Required Inputs

1. PR URL/number; otherwise current branch.
2. Validated change batch (working-tree changes, finding IDs, validator results), or a head already pushed by a delegate (`/git rebase`, `/pr restack`, `/pr stack`).
3. Caller-owned round state and current packet/evidence from [`gates.md`](gates.md). Never reset or start a loop.
4. Optional deferral flag from monitor to batch several remediations into one head.

## Workflow

1. Invoke `/pr info`; verify one open PR. Record authoritative `baseRefOid` and `headRefOid`.
2. When the caller defers publication, return the staged batch and pending state. Do not commit or push, and do not claim convergence. Stop here.
3. Dirty tree, no delegate push: require validation passed, and that only the returned batch dirties the tree. Require `author.login` = viewer, current branch = `headRefName`, `HEAD` = `headRefOid`, unchanged base/head, and a pushable non-fork source branch. If the PR is open and non-draft and the round state lacks `drafted_for_changes`, stop `blocked`: the rule in `gates.md` must run before edits, so convert the PR to draft under that rule and rerun `/pr push`. Otherwise stop `blocked` with the exact checkout/sync/access action. Never switch branches or overwrite work.
4. Commit the logical group (no empty commits, no unrelated changes), referencing finding IDs. Push with a plain `git push`. Use `--force-with-lease` only for a rewrite the invoking action named; never plain `--force`, and never force-push `main`/`develop`.
5. Re-resolve the authoritative base/head with `/pr info`. A changed head consumes the reserved round and invalidates head-bound outcome, CI, quality/security, readiness, and approval evidence. Return that state to the caller. Never reset the budget.
6. Run `/pr description` once for the new head. Description-once-per-head: skip a head already described, and do not run it for a head that did not change. `/pr description` owns screenshots and its stop gates.
7. Return the new head, round state, invalidated evidence, and description result.

## Safety Rules

- Never push with failing validation, an unverified PR, or an unexpected tree state.
- Never publish intermediate heads when the caller batches remediation.
- Never push to another author's PR or a fork branch without explicit permission.
- Never run tests, source review, reply to threads, resolve threads, approve, mark ready, or merge here.
- Authentication, permission, push-rejection, and incomplete-data failures are blockers.

## Output Style

Report PR, resolved base/head before and after, commit SHAs, push result, invalidated evidence and round state, description result, and any blocker with the exact unblocking action.
