# Stacked-PR workflows and semantics (condensed)

Sources: https://github.github.com/gh-stack/guides/stacked-prs/ and https://github.github.com/gh-stack/guides/workflows/

## Merge semantics (critical)

- Merging any stacked PR **also merges every unmerged PR below it** in one atomic operation.
  - Merge the **top** PR → the whole stack lands.
  - Merge a **mid** PR → it and everything below land; PRs above stay open.
  - Merge the **bottom** PR → only that PR lands.
- Only contiguous groups starting from the lowest unmerged PR can land; you cannot skip a lower PR.
- **Merging is web-UI only** — the CLI cannot merge stacked PRs; give the user the PR URL.
- After a partial merge, GitHub **automatically rebases and retargets** the remaining PRs so the next unmerged PR targets the trunk directly.
- A fully merged stack is complete and cannot be extended; `gh stack submit` on new branches starts a **new** stack rooted at trunk.

## Review model

- Each PR shows only its layer's diff (branch vs the branch below); reviews are independent per PR.
- The stack map on each PR shows the full picture; read bottom→top for the whole story.

## Recipes

### Standard flow

```
gh stack init <first-branch>     # create + checkout first layer
# ...code, commit...
gh stack add <next-branch>       # next layer
# ...code, commit...
gh stack submit --auto           # push + create stacked PRs
gh stack sync                    # as PRs merge upstream
```

### Abbreviated flow (`add -Am`)

`gh stack add -Am "<msg>"` stages all, commits, and — if the current branch already has commits — creates a new auto-named branch (`03-24-slug`). If the current branch has no commits yet, the commit lands there instead. Pass an explicit name to control it: `gh stack add -Am "API routes" api-routes`.

### Mid-stack change

Never hack a lower-layer fix into the current layer; make it where it belongs:

```
gh stack down                    # or: gh stack checkout <branch>
git add <files> && git commit -m "<fix>"
gh stack rebase --upstack        # cascade through layers above
gh stack top                     # return to where you were
```

### Review feedback

```
gh stack checkout <branch>       # branch the reviewer commented on
git add . && git commit -m "Address review feedback"
gh stack rebase                  # cascade fixes upward
gh stack push                    # force-with-lease, atomic
```

### After a bottom PR merges

`gh stack sync` — fetch, reconcile remote stack, fast-forward trunk, cascade rebase, push, sync PR state. Non-interactively there is no prune prompt: merged local branches are only deleted with an explicit `--prune`. PRs added to the stack on GitHub by others are pulled down and appended automatically; true divergence prompts (or aborts non-interactively).

### Adopt existing branches

```
gh stack init feat/auth feat/api feat/ui   # bottom→top; existing adopted, missing created
gh stack view
gh stack submit --auto                     # link PRs (already-open PRs are detected)
```

### Collapsing a stack into one PR

Fold an entire stack into a single PR. **Destructive** — confirm survivor, close-vs-leave-open, and squash-vs-preserve before running (defaults: survivor = top PR, leave lower branches intact, preserve commits).

Preflight (both tiers) — verify the survivor descends from every lower head:

```
# survivor = top branch; for each lower branch head:
git merge-base --is-ancestor <lower-head> <survivor-head> || echo "ABORT: <lower-head> not an ancestor"
```

Abort and ask if any check fails (diverged/non-linear stack).

**T1 (gh stack CLI):**

```
gh stack unstack <n>                                   # dissolve the stack on GitHub
gh pr edit <survivor> --base <trunk>                   # re-point survivor to trunk
gh pr close <lower> --comment "Folded into #<survivor>"  # per lower PR; branch left intact
gh pr edit <survivor> --title "<full changeset>" --body "<full changeset>"
```

**T2 / host-alias fallback (REST API, explicit owner/repo):**

```
gh api -X POST  repos/{o}/{r}/stacks/{n}/unstack
gh api -X PATCH repos/{o}/{r}/pulls/{survivor} -f base=<trunk>
# per lower PR:
gh api -X POST  repos/{o}/{r}/issues/{lower}/comments -f body="Folded into #<survivor>"
gh api -X PATCH repos/{o}/{r}/pulls/{lower} -f state=closed
# refresh survivor title/body:
gh api -X PATCH repos/{o}/{r}/pulls/{survivor} -f title="<full changeset>" -f body="<full changeset>"
```

Use the REST path with explicit `owner/repo` whenever the remote uses a custom SSH host alias (e.g. `github.com-work`), which breaks `gh stack` repo auto-detection.

## Structuring guidance (for planning stacks)

- Stacks are **strictly linear**: one parent, at most one child per branch. Parallel workstreams need separate stacks.
- Stage deliberately with plain `git add <files>` / `git commit` so each layer's PR contains exactly its concern; use `-Am` only for simple single-commit layers.

- Layers tell a cohesive story bottom→top: foundational changes low (schema/models), dependent changes high (API → UI → tests).
- Start a new layer (`gh stack add`) at a change of concern: backend→frontend, logic→tests/docs, different reviewer audience, or current branch already big enough to review.
- One stack = one effort; unrelated work gets its own stack (`gh stack init`) or an existing one (`gh stack checkout`).

## CLI vs web-UI rebase

| | CLI `gh stack rebase` | Web "Rebase Stack" button |
| --- | --- | --- |
| Runs | locally | on GitHub's servers |
| Signing | local committer config (GPG/SSH) | committer = button-clicker, **unsigned** |
| Conflicts | interactive, `--continue` | unavailable — must rebase locally |

Prefer the CLI when commit signing matters or conflicts are possible.

## Conflict resolution cycle

```
gh stack rebase        # stops, prints conflicted files + lines
# resolve markers, then:
git add <resolved-files>
gh stack rebase --continue   # remaining branches rebase automatically
# or: gh stack rebase --abort  → restores all branches to pre-rebase state
```

## Official agent skill

GitHub ships its own agent skill: `gh skill install github/gh-stack` (or `npx skills add github/gh-stack`) — an alternative/complement to this one for harnesses that support it.
