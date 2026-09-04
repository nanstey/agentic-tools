---
name: new-repo
description: Creates and configures a private GitHub repository for an existing local git project, including protected-main and squash-only policy. Use when a local repository needs a GitHub remote.
user-invocable: true
disable-model-invocation: false
---

# New Repo

## Core Contract

Create one GitHub repository for an existing local git repository, set its
`origin`, and apply the agreed repository and `main` branch policy. Default
visibility is **private**. Never create a repository, push its first branch, or
replace an existing remote without the required confirmation.

This skill owns GitHub repository creation, first push, merge policy, and branch
protection. It does not scaffold an application; invoke `new-app` first when a
local application needs to be created.

## Required Inputs

1. The existing local repository path.
2. The explicit GitHub owner — a user account or organization. Never infer it
   from the authenticated account.
3. The explicit repository name.
4. Visibility, if not private.
5. When more than one GitHub account is authenticated, the account that must
   perform the operation.
6. Optional: project architecture/stack context (services, env files, local
   ports) — feeds the final `worktree-env` step when provided.

Stop and ask before creation if the owner or repository name is absent. Stop and
ask before the first push, even after the remote was created.

## Workflow

1. Preflight the local repository without changing it:
   ```sh
   git rev-parse --is-inside-work-tree
   git rev-parse --show-toplevel
   git show-ref --verify --quiet refs/heads/main
   git log -1 --oneline main
   git remote get-url origin
   ```
   Require a local `main` branch with at least one commit. A missing `origin` is
   expected. If `origin` exists and is not the requested GitHub repository,
   including a non-GitHub URL, stop and get explicit user direction; do not
   overwrite, remove, or repoint it. If it already matches the requested
   repository, stop and ask whether the user wants a configuration-only run;
   do not run `gh repo create` against it.
2. Verify tooling and GitHub identity before relying on either:
   ```sh
   command -v git
   command -v gh
   gh auth status --hostname github.com
   gh api user --jq .login
   ```
   Confirm the displayed account is the requested account. For another signed-in
   account, use `gh auth switch --hostname github.com --user <login>` only with
   the user's direction, then repeat the identity check. Confirm the explicit
   owner is accessible to that account; do not substitute the authenticated user
   for an owner organization.
3. Confirm the planned `<owner>/<repo>`, private visibility (unless explicitly
   changed), and that `origin` is absent. Create the remote and set `origin`
   without pushing:
   ```sh
   gh repo create "$OWNER/$REPO" --private --source=. --remote=origin
   ```
   Do not use `--push`. If creation or remote setup fails, report which one
   failed and leave the local repository otherwise unchanged.
4. Show the exact first-push command and stop for explicit confirmation. Only
   after the user confirms, publish `main`:
   ```sh
   git push -u origin main
   ```
   This initial direct push is necessary to create `main`; apply protection only
   after it exists.
5. Configure merge policy after `main` exists. The following documented REST
   request enables only squash merging and uses the PR title with a blank squash
   commit body:
   ```sh
   gh api --method PATCH \
     -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2026-03-10" \
     "repos/$OWNER/$REPO" \
     --input - <<'EOF'
   {
     "allow_squash_merge": true,
     "allow_merge_commit": false,
     "allow_rebase_merge": false,
     "squash_merge_commit_title": "PR_TITLE",
     "squash_merge_commit_message": "BLANK"
   }
   EOF
   ```
6. Protect `main` after the push. This request requires pull requests while
   allowing zero approvals for solo repositories, applies protection to admins,
   and disallows force pushes and deletions. It grants no bypass actors:
   ```sh
   gh api --method PUT \
     -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2026-03-10" \
     "repos/$OWNER/$REPO/branches/main/protection" \
     --input - <<'EOF'
   {
     "required_status_checks": null,
     "enforce_admins": true,
     "required_pull_request_reviews": {
       "dismiss_stale_reviews": false,
       "require_code_owner_reviews": false,
       "required_approving_review_count": 0,
       "require_last_push_approval": false
     },
     "restrictions": null,
     "required_linear_history": false,
     "allow_force_pushes": false,
     "allow_deletions": false,
     "block_creations": false,
     "required_conversation_resolution": false,
     "lock_branch": false,
     "allow_fork_syncing": false
   }
   EOF
   ```
   `required_pull_request_reviews` with an approving-review count of `0`
   requires a pull request without requiring an approval. Omitting bypass
   allowances grants no user, team, or app an explicit bypass, and
   `enforce_admins: true` applies the policy to administrators.
7. Verify both API states, and report each failed step separately rather than
   declaring the repository fully configured:
   ```sh
   gh api -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2026-03-10" \
     "repos/$OWNER/$REPO" \
     --jq '{private,allow_squash_merge,allow_merge_commit,allow_rebase_merge,squash_merge_commit_title,squash_merge_commit_message}'
   gh api -H "Accept: application/vnd.github+json" \
     -H "X-GitHub-Api-Version: 2026-03-10" \
     "repos/$OWNER/$REPO/branches/main/protection" \
     --jq '{enforce_admins,required_pull_request_reviews,allow_force_pushes,allow_deletions}'
   ```
   A `403` or `404` from branch-protection creation or verification is a partial
   failure, not a successful policy configuration. Explain the response and the
   policy settings that remain unverified.
8. If the Orca IDE runs this session, invoke `orca-repo` to register the
   repository with Orca. Skip silently when Orca is not present.
9. If the user provided architecture/stack context — or asks for worktree
   environments — invoke `worktree-env` against this repository as a final
   step, passing that context (services, env files, ports) as its inputs. Skip
   silently when no architecture context was provided and none was requested.

## GitHub API Caveat

GitHub branch protection availability depends on repository visibility and plan:
private repositories require GitHub Pro, Team, or Enterprise; GitHub Free
supports branch protection only on public repositories. Do not silently change
visibility to work around this restriction.

The repository merge-method settings only control which methods merge pull
requests; they do **not** prevent direct pushes. The branch-protection request is
what requires pull requests and prevents direct pushes under this policy.

## Safety Rules

- Never create a repository without an explicit owner and repository name.
- Never create a public repository or change visibility without explicit user
  direction; default to private.
- Never use `gh repo create --push`; never push before explicit confirmation.
- Never overwrite, remove, or repoint an existing `origin` without explicit user
  direction.
- Never claim branch protection is configured after a failed `gh api` call,
  including a `403` or `404`.
- Never claim merge-method settings prevent direct pushes; report branch
  protection as the mechanism that does so.
- Never reduce required approving reviews below zero or add an approval
  requirement by default; the required count is exactly `0`.

## Output Style

Report the local repository path, GitHub owner/name, selected account,
visibility, remote URL, first-push confirmation, merge-policy verification,
branch-protection verification, the `orca-repo` outcome (invoked or not
applicable), and the `worktree-env` outcome (invoked, skipped, or its reported
result). On any failure, identify the completed steps, the exact failed command
or API response, and remaining manual action.
