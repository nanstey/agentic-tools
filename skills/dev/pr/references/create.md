# PR Create

## Core Contract

Create exactly one PR for the current branch against the correct base.
Default tool is `gh`. Default target branch is the repository default branch (`origin/HEAD`); PR opens as draft unless asked otherwise.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch with at least one commit ahead of base.
2. Base branch if non-default.
3. Draft vs ready preference (default draft).

## Workflow

1. Resolve PR state via `/pr info`; if a PR already exists, report it and stop.
2. Confirm the branch is pushed; push with `git push -u origin <branch>` if needed.
   Then check write access: `gh repo view --json viewerPermission` must report `WRITE`, `MAINTAIN`, or `ADMIN`. A push over SSH can succeed under a different identity than the active `gh` account, so a successful push does not prove it. If access is `READ` or `TRIAGE`, see the identity rule in Safety Rules.
3. Determine the target branch (explicit input > repo convention > `origin/HEAD` default branch).
4. Analyze the branch diff against the target (`git log <base>..HEAD`, `git diff --stat <base>...HEAD`, `git diff <base>...HEAD`) to draft a title and a placeholder body.
5. Create the PR with `gh pr create --draft --base <base> --title ... --body ...`.
6. Run `/pr description` to write the full body from the diff.
7. Verify by re-reading the PR: the body must be the `/pr description` output (structured sections, not the placeholder) and the PR must be a draft. Report the URL.

Stop as blocked if the branch has no commits ahead of base or push fails.

## Safety Rules

- Never create a second PR when one already exists for the branch.
- When the active `gh` account lacks write access, use another stored account only if it is the repo owner or matches the SSH push identity (`ssh -T git@github.com`) and `gh repo view --json viewerPermission` shows write access for it. Scope its token to each command (`GH_TOKEN="$(gh auth token --user <account>)" gh ...`). Never run `gh auth switch`, `login`, or `logout`, and never print, log, or store the token. Otherwise stop as blocked and name the account that needs access.
- Never force-push or rewrite history; pushing the branch is the only allowed git mutation.
- Never skip step 6: a PR whose body is a commit message or placeholder is not created correctly. Do not use `gh pr create --fill`.
- Never write the final body inline; delegate it to `/pr description`.
- Never mark the PR ready-for-review unless explicitly asked.
- If unexpected working tree changes appear while you are working, stop as blocked and report the unexpected changes.

## Output Style

Report PR number/URL, base used, draft state, push performed or not, and any blocker.
