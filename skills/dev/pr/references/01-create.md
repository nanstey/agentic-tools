# PR create

Create one draft PR for the current branch.

## Inputs

- Current branch with commits ahead of base, optional base, and draft preference (default: draft).

## Steps

1. Run `pr snapshot`; stop if the branch already has a PR. When it returns `exists: false`, run `pr next` to confirm phase 1 (`Create`) and continue without `pr guard`.
2. Choose the target explicitly, by repository convention, or the default branch. Review the diff and prepare an explicit title and placeholder body file.
3. Publish the branch with `git push -u origin <branch>` when needed. Then check `gh repo view --json viewerPermission`; require `WRITE`, `MAINTAIN`, or `ADMIN` for the active `gh` identity. A successful SSH push does not prove that identity has PR write access.
4. Create one draft PR with `gh pr create --draft --base <base> --title <title> --body-file <path>`. Do not use `--fill`. Never use `gh auth switch`; never print, log, or store tokens. If the active identity lacks access, stop blocked unless a stored account is the repository owner or matches the SSH push identity and has write access. If using that account, scope its token only to the individual command without displaying it.
5. After creation, start the PR run with `pr run start --pr <PR-URL> --action create`, then run `/pr description` to write the full body. Route body changes through `pr body [target] --run <id> --file <path>`.
6. Verify with `pr snapshot [target]`; require a draft PR with the completed description.

## Output

Report PR number/URL, base, draft state, publication, and any blocker.
