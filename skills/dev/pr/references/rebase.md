
# PR rebase (base-aware)

PR-aware wrapper around `/git rebase`.
Its job is to pin the base branch from PR metadata and carry PR intent into conflict resolution.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Steps

1. Resolve PR with `/pr info` and capture `baseRefName`, title, body, and `stack`.
2. If `stack` is non-null, the PR is a layer of a GitHub native stack: stop and use `/pr stack` (`gh stack rebase`/`sync`) instead — rebasing one layer in isolation desyncs the layers above.
3. If no PR exists, use an explicit base from the invocation, else generic `/git rebase` base detection.
4. Delegate to `/git rebase` with base pinned to PR base.
5. Let `/git conflicts` handle pauses.
6. Do not re-implement fetch/rebase/push logic here.

## Guards

- Do not run on `develop` or `main`; never force-push them. (`/git rebase` enforces this too.)
- Prefer `--force-with-lease` over `--force` so a mismatched remote aborts.
- If PR base metadata is missing or ambiguous, stop as blocked instead of guessing.

## Output Style

Report PR resolved, base used, whether delegation to `/git rebase` completed, conflict status, and push result.
