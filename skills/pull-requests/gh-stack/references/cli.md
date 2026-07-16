# gh-stack CLI reference (condensed)

Install: `gh extension install github/gh-stack` (requires `gh` v2.0+).
Sources: https://github.github.com/gh-stack/reference/cli/ and the official agent skill (github/gh-stack `skills/gh-stack/SKILL.md`).

## Agent-safety preflight

Any command that would prompt hangs an agent. Before first use:

```
git config rerere.enabled true        # init prompts to enable rerere on first run otherwise
git config remote.pushDefault origin  # multi-remote repos: avoids remote picker in push/submit/sync/link/checkout
```

Always pass explicit arguments/flags. **TUI/prompt traps:**

- `gh stack view` and `gh stack view --short` — both launch a TUI; only `--json` is safe
- `gh stack submit` without `--auto` — prompts per-PR for titles
- `gh stack init` / `add` / `checkout` without arguments — interactive prompts/pickers
- `gh stack checkout <pr-number>` when a different local stack exists on those branches — unbypassable conflict prompt; run `gh stack unstack` (or `unstack --local`) first, then retry
- `gh stack switch` and `gh stack modify` — always interactive

Output convention: status messages → **stderr** (✓/✗/⚠/ℹ prefixes); data (`view --json`) → **stdout**.

## Local stack management

### `gh stack init [flags] [branches...]`

Initialize a stack. With branch names: adopts existing branches, creates missing ones (non-interactive). Without: interactive prompts — avoid. Enables `git rerere` automatically.

- `-b, --base <branch>` — trunk (defaults to repo default branch)

```
gh stack init feature-auth feature-api feature-ui
gh stack init --base develop feature-auth
```

### `gh stack add [flags] [branch]`

Create a branch at HEAD on top of the stack and check it out. Must run from the topmost branch (off-top exits 5 — `gh stack top` first). Without a name (and without `-m`): prompts — pass a name. Branch names are used verbatim (slashes kept, nothing prefixed). Uncommitted changes carry over to the new branch (working tree untouched); commit or stash first for a clean start. Prefer plain `git add`/`git commit` per layer for deliberate staging; `-Am` is a shortcut for single-commit layers.

- `-A, --all` — stage all changes incl. untracked (requires `-m`)
- `-u, --update` — stage tracked only (requires `-m`; mutually exclusive with `-A`)
- `-m, --message <msg>` — commit before branching; auto-generates branch name (`03-24-add_login`) when no name given

### `gh stack view --json`

Show stack state. **Only `--json` is agent-safe** (bare and `--short` launch a TUI). Output:

```json
{ "trunk": "main", "currentBranch": "api-routes",
  "branches": [ { "name": "auth", "head": "<sha>", "base": "<parent sha>",
    "isCurrent": false, "isMerged": true, "needsRebase": false,
    "pr": { "number": 42, "url": "...", "state": "MERGED" } } ] }
```

`pr` omitted when no PR; `pr.state` is `OPEN`/`MERGED`; `needsRebase` = base not an ancestor. Useful jq:

```
gh stack view --json | jq '[.branches[] | select(.needsRebase)] | length'   # rebase needed?
gh stack view --json | jq -r '.branches[] | select(.isMerged) | .name'      # merged branches
gh stack view --json | jq '[.branches[].isMerged] | all'                    # stack fully merged?
```

### `gh stack checkout [<stack-number>|<pr-number>|<pr-url>|<branch>]`

Check out a stack; fetches and sets up remote stacks locally. Bare numbers try stack/PR number first, then branch. No argument: interactive picker — always pass an argument. Branch names resolve against locally tracked stacks only; use a PR/stack number to pull remote stacks. **If local and remote stack compositions differ, an unbypassable prompt appears** — `gh stack unstack` first, then retry.

### `gh stack modify [flags]`

Interactive TUI to restructure (drop `x`, fold down `d` / up `u`, insert `i`/`I`, move `Shift+↑/↓`, rename `r`, undo `z`; apply `Ctrl+S`). **TUI-only — do not drive blind.** Preconditions: active stack, clean tree, no rebase in progress, no PR queued, linear history. Merged-PR branches locked.

- `--continue` — after resolving apply-phase rebase conflicts
- `--abort` — restore pre-modify state

Non-TUI alternative for restructuring: `gh stack unstack --local` → `gh stack init <new-order...>` → `gh stack submit`.

### `gh stack unstack [<stack-number>] [flags]` (alias: `delete`)

Unstack on GitHub + remove local tracking. No arg: active stack. With number: works from anywhere via API. Merged/merging/queued PRs stay stacked. All PRs removed ⇒ stack dissolved.

- `--local` — remove local tracking only; never contacts GitHub. Error when combined with a number not tracked locally.

`unstack <number>` is a remote-first API wrapper: works from anywhere in the repo, tracked locally or not. Unknown number ⇒ "not found on GitHub" (exit 2).

## Remote operations

### `gh stack submit [flags]`

Push all branches, create stacked PRs, create/update the GitHub stack. Interactive editor by default — **use `--auto`**. Fully merged stack ⇒ auto-starts a new stack for unmerged branches.

- `--auto` — skip editor, auto titles; new PRs created as **drafts** unless `--open`
- `--open` — new/existing PRs ready for review
- `--remote <name>`

### `gh stack sync [flags]`

Fetch → reconcile remote stack (remote-ahead pulls automatically; true divergence prompts, or aborts non-interactively) → fast-forward trunk → cascade rebase (conflict ⇒ restores all branches, advises `gh stack rebase`) → push (`--force-with-lease`) → sync PR state → link stack on GitHub → prune prompt.

- `--prune` — auto-delete local branches for merged PRs
- `--remote <name>`

Divergence options (interactive): use remote as source of truth / delete GitHub stack (PRs+branches untouched; recreate with `submit`) / cancel.

### `gh stack rebase [flags] [branch]`

Fetch, then cascading rebase from trunk upward. Merged-PR branches auto-switch to `--onto` replay. On conflict: pauses, prints conflicted files; resolve, `git add`, then `--continue`.

- `--downstack` / `--upstack` — limit to below/above current branch
- `--no-trunk` — skip fetch + trunk rebase
- `--continue` / `--abort`
- `--remote <name>`
- `--committer-date-is-author-date` (alias `--preserve-dates`)

### `gh stack push [flags]`

Push all stack branches with `--force-with-lease --atomic`. No PR creation (use `submit`). `--remote <name>`.

### `gh stack link [flags] <stack-number|branch-or-pr> <branch-or-pr> [...]`

Create/update a GitHub stack from branches or PR numbers/URLs **without local tracking** (for jj/Sapling/git-town users). Args bottom→top. Branches are pushed; missing PRs created with correct base chaining; wrong bases corrected. Additive only. Numeric first arg matching an existing stack ⇒ append remaining args to its top.

- `--base <branch>` (default `main`; ignored when extending)
- `--open` — PRs ready for review
- `--remote <name>`

## Navigation

`gh stack switch` (interactive picker — avoid), `gh stack up [n]`, `gh stack down [n]`, `gh stack top`, `gh stack bottom`, `gh stack trunk`. All clamp at stack bounds. Navigation **skips merged branches**; `bottom` lands on the first non-merged branch above trunk.

## Misc

- `gh stack alias [name]` — install `gs` (or custom) wrapper in `~/.local/bin/`
- `GH_STACK_THEME` = `auto|light|dark`

## Exit codes and recovery

| Code | Meaning | Agent action |
| --- | --- | --- |
| 0 | Success | proceed |
| 1 | Generic error | read stderr |
| 2 | Not in a stack / not found | `gh stack init` first, or check the number |
| 3 | Rebase conflict | parse stderr for files, resolve, `git add`, `gh stack rebase --continue` |
| 4 | GitHub API failure | check `gh auth status`, retry |
| 5 | Invalid arguments (e.g. `add` off-top) | fix invocation; `gh stack top` before `add` |
| 6 | Branch in multiple stacks | checkout a non-shared branch first |
| 7 | Rebase already in progress | `--continue` (after resolving) or `--abort`; never start another |
| 8 | Stack locked by another process | lock times out after ~5s; wait and retry |
| 9 | Stacked PRs not enabled for repo | fall back (T2/T3); interactive `submit` offers plain unstacked PRs, non-interactive exits 9 |

## Known limitations

- Stacks are **strictly linear** — one parent, at most one child per branch; parallel workstreams need separate stacks.
- **Merging stacked PRs from the CLI is not supported** — merge via the PR page in the browser.
- `submit` PR titles/bodies are auto-generated only (single commit → commit subject/body; multiple → humanized branch name); customize afterwards with `gh pr edit`.
- Exit-6 disambiguation cannot be bypassed with a flag.
- Remote stack checkout needs a PR/stack number; branch names are local-only.
