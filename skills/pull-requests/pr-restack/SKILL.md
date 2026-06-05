---
name: pr-restack
description: >-
  Rebase a stack of dependent branches/PRs after upstream branches change or
  merge. Use when a stack of PRs needs updating because an upstream branch was
  rebased, force-pushed, drifted in content, or was merged to its root base
  branch (for example `develop` or `main`), and
  downstream branches must be re-pointed at the correct base while preserving
  their unique commits.
---

# PR Restack

Re-align a stack of dependent branches/PRs after upstream branches drifted, were rebased, force-pushed, or merged to the stack root base branch (commonly `develop` or `main`). Each downstream branch should end up rebased onto the correct new base with only its own commits, then force-pushed safely.

## Hard rules

- **Plan first.** Do not rebase, force-push, or modify branches until the user approves the plan.
- **No destructive ops without a backup.** Before touching any branch, create a recoverable backup ref (see Step 3).
- **Never `git push --force`.** Always use `--force-with-lease=<branch>:<expected-remote-sha>` so a stale push aborts.
- **Drop duplicates freely; surface anything else.** Commits on a downstream branch that are exact duplicates of newer upstream commits (cherry-picked forward, rebased forward, squash-merged into the new base) should be dropped during the rebase — that is the point. Any *other* commit about to disappear must be flagged and confirmed before continuing.
- **Always rebase onto the current stack root base.** Discover the root base from PR metadata (`baseRefName` of the bottom PR). Fast-forward local `<root-base>` to `origin/<root-base>` and treat that tip as the floor of the stack.
- **Refresh lockfiles after rebase.** If `package.json` or `pnpm-lock.yaml` was touched, run `pnpm install` and commit any lockfile changes onto the branch before pushing.
- **Typecheck before push.** Run `pnpm typecheck` (scoped to changed packages when feasible) on each branch after the rebase + lockfile refresh. Do not push or move to the next branch until it passes.
- **Stop on ambiguity.** If a branch's intended base is unclear, the upstream PR's merge style is unknown, or rebase conflicts aren't trivial, halt and ask the user.
- **Root base is metadata-driven.** Allow `develop`, `main`, or another explicit PR base. If PR metadata is missing or ambiguous, stop and ask.

## Inputs to gather

Before mapping the stack, confirm with the user:

1. **The top of the stack** (or list of branches in the stack). If unstated, ask — do not guess.
2. **What changed upstream**, if known: rebased, force-pushed, content drift, merged to the stack root base (squash/rebase/merge commit). This narrows what to look for; still verify with git.
3. **Whether any upstream PR was merged** and how (squash vs. rebase vs. merge commit). Affects whether original commits exist in the root base branch's history.

## 1. Map the stack

Goal: produce an ordered list `[<root-base> → A → B → C → …]` where each branch's current and intended base are explicit.

```bash
git fetch origin --prune --tags

# Determine ROOT_BASE from the bottom PR's baseRefName (or ask user if missing).
# Fast-forward local ROOT_BASE so it matches origin/ROOT_BASE. This is the floor
# of the stack — every branch will end up rebased on top of this tip.
git checkout "$ROOT_BASE" && git pull --ff-only origin "$ROOT_BASE"

gh pr list --state open --json number,title,headRefName,baseRefName,isDraft \
  --limit 100
```

If `git pull --ff-only` fails, local `ROOT_BASE` has diverged. Stop and resolve that with the user before planning anything else.

For each branch in the stack, record:

- `head` — the branch name.
- `pr_base` — the PR's `baseRefName` (the branch the PR currently targets).
- `pr_state` — `OPEN` / `MERGED` / `CLOSED`. For `MERGED`, capture `mergeCommit.oid` and `mergedAt` via `gh pr view <num> --json state,mergeCommit,mergedAt,mergeStateStatus`.
- `local_tip` — `git rev-parse <head>` (if checked out locally).
- `remote_tip` — `git rev-parse origin/<head>`.
- `merge_base_with_pr_base` — `git merge-base origin/<head> origin/<pr_base>`.
- `merge_base_with_root_base` — `git merge-base origin/<head> origin/<root-base>`.

If a branch has no PR, ask the user where it should target. Don't infer.

## 2. Detect drift per branch

For each downstream branch `B` with PR base `A`, classify what happened. Run these checks against `origin/*` refs:

| Signal | Diagnostic |
| --- | --- |
| `A` is merged to the root base | `gh pr view` shows `MERGED`. New base is `<root-base>`. |
| `A` was rebased / force-pushed | `git merge-base origin/A origin/B` is older than `origin/A`'s previous tip recorded in `B`'s history; equivalent commits exist on `A` with new SHAs. |
| `A` has new commits (no rewrite) | `git log <merge-base>..origin/A` is non-empty and `B` does not contain them. |
| `A` had commits removed | `git range-diff <old-A-tip>..<old-A-tip-prev> origin/A` shows commits with no counterpart, or `git log origin/A..<old-A-tip>` is non-empty. |
| `B` was force-pushed locally | `local_tip != remote_tip`. Confirm intent before overwriting. |

To find the previous tip of `A` that `B` was last rebased onto, prefer in this order:

1. `git reflog show origin/A` (if local).
2. The parent of `B`'s oldest unique commit: `git log --format=%H origin/A..origin/B | tail -1` then its first parent that is on `origin/A`.
3. Reflog of `B` showing the last `rebase finished` entry.

Use `git range-diff <prev-A-tip>..origin/B <new-A-tip>..origin/B` to verify which of `B`'s commits already exist on `A` (and would be dropped on rebase) vs. which are genuinely `B`'s own work.

## 3. Assess risk and flag

Before the plan is finalized, surface each of these explicitly:

- **Dropped commits.** Any commit on `B` that has a counterpart in old `A` but no counterpart anywhere reachable from new `A` or `<root-base>` is at risk of vanishing. List them. Decide with the user: keep (and resolve conflicts), drop, or stop.
- **Squash-merged upstream.** If `A` was squash-merged to `<root-base>`, the squash commit there has a different tree from any individual `A` commit. Rebasing `B` onto `<root-base>` with `--onto <root-base> <old-A-tip>` is correct, but conflicts are likely — flag this.
- **Cross-stack dependencies.** If `B` imports/calls code introduced in `A` that was deleted or renamed in new `A`, the rebase will produce semantic breakage even if it merges cleanly. Note any rename/delete in `git diff <old-A-tip> <new-A-tip> --name-status`.
- **Multiple parents in stack.** If two downstream branches both target `A`, rebase order doesn't matter between them, but each needs its own `--onto`.
- **Branches with no PR or ambiguous base.** Stop and ask.
- **Open review state.** Note any branches with active reviewer threads — the user may want to coordinate timing.

## 4. Build the plan

Write the plan to `.ai/plans/${YYYY-MM-DD}-pr-restack-plan.md` and present it for approval. Include:

1. **`<root-base>` floor** — current `origin/<root-base>` SHA the stack will be rebased onto.
2. **Stack diagram** (Mermaid or ASCII) showing current vs. target bases.
3. **Per-branch table:**

   | Branch | Current base | New base | Commits kept | Commits dropped (duplicates) | Lockfile touched? | Typecheck scope | Risks/conflicts |
   | --- | --- | --- | --- | --- | --- | --- | --- |

4. **Rebase order** — bottom-up, with the bottom branch rebased onto the current `<root-base>` tip.
5. **Backup refs** to be created (see Step 5).
6. **Force-push lease values** (the `origin/<branch>` SHA each push will assert against).
7. **Open questions** — anything that needs user input before execution.

Wait for explicit user approval before continuing.

## 5. Execute the plan

Create one backup ref per branch before touching anything:

```bash
for b in "${BRANCHES[@]}"; do
  git update-ref "refs/backup/pr-restack/$(date +%s)/$b" "origin/$b"
done
```

Then for each branch, in plan order (bottom-up):

```bash
# Variables per branch:
#   BRANCH         downstream branch being rebased
#   OLD_BASE_TIP   tip of upstream that BRANCH was last rebased onto
#   NEW_BASE       upstream's current tip (or origin/<root-base> if upstream was merged)
#   EXPECTED_REMOTE  remote SHA captured during planning, used for the lease

git fetch origin --prune
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
```

Delegate the rebase execution primitive to **`/rebase`** (do not run raw `git rebase` here):

- `branch="$BRANCH"`
- `new_base="$NEW_BASE"`
- `old_base_tip="$OLD_BASE_TIP"` (transplant mode)
- `push=false` (push happens only after lockfile/typecheck checks below)

If `rebase` pauses on conflicts, let the delegated `rebase` flow hand off to `conflicts`.

If a conflict is in a duplicate commit already present in `NEW_BASE`, it is expected and can be skipped after confirming with `git diff`.

Additional stack-specific conflict policy:

- If the conflict is in `pnpm-lock.yaml`, prefer the rebase target's lockfile, continue the rebase, then regenerate lockfiles below.
- If the conflict is non-trivial or destroys intent, stop and ask the user. Do not improvise on stacked branches — a wrong call here propagates upward.

After the rebase finishes, refresh the lockfile if needed:

```bash
# Did the rebase touch package.json or pnpm-lock.yaml on this branch?
if git diff --name-only "$NEW_BASE...$BRANCH" \
     | grep -qE '(^|/)(package\.json|pnpm-lock\.yaml)$'; then
  pnpm install
  if ! git diff --quiet -- pnpm-lock.yaml; then
    git add pnpm-lock.yaml
    git commit -m "chore: refresh lockfile after restack"
  fi
fi
```

Then typecheck the branch. Prefer scoped packages over the full graph (per CLAUDE.md):

```bash
# Pass the directories of changed packages, e.g. apps/client domains/schedules
pnpm typecheck <changed-packages>
# Or, if scoping is impractical for this branch:
pnpm typecheck
```

If typecheck fails, stop. Do not push and do not move to the next branch — fix on this branch (typically by amending or adding a fix commit, then re-running typecheck), or abort and surface to the user.

Finally, verify the branch shape before pushing:

```bash
# Same set of changes vs. the previous version of the branch?
git range-diff "refs/backup/pr-restack/.../$BRANCH" "$BRANCH"

# Branch's own commits are now exactly the ones the plan said to keep
git log --oneline "$NEW_BASE..$BRANCH"
```

If the diff or log doesn't match the plan, stop and report. Otherwise push:

```bash
git push --force-with-lease="$BRANCH:$EXPECTED_REMOTE" origin "$BRANCH"
```

If the lease fails, the remote moved since planning. Refetch, re-plan that branch, and retry — never escalate to `--force`.

After pushing, if the PR's base needs to change (e.g., upstream was merged so the PR should target `<root-base>`), update it:

```bash
gh pr edit <pr-number> --base "<root-base>"
```

Repeat for the next branch up the stack. Each branch's `OLD_BASE_TIP` for its own children is the **post-rebase tip** of the parent, not the captured upstream value.

## 6. Report back

Keep it short:

- One line per branch: old base → new base, SHA before → SHA after, PR URL.
- Backup refs created (so the user can recover).
- Anything skipped, deferred, or that needs follow-up review.

## Reference: useful git incantations

- `git log --graph --oneline --decorate --boundary origin/<root-base>..origin/<branch>` — visualize a branch's unique history.
- `git range-diff A..B C..D` — compare two ranges of commits, ignoring SHA churn from rebases. The primary tool for "did upstream rewrite history or actually change content?"
- `git merge-base --fork-point origin/<base> <branch>` — sometimes finds the previous base when the reflog is gone (best-effort, can be wrong on shared branches).
- `git for-each-ref refs/backup/pr-restack/` — list backup refs created by this skill.
- `git reflog show <branch>` — recover from a bad rebase: `git reset --hard <branch>@{1}`.
