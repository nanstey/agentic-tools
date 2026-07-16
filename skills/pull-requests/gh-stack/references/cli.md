# gh-stack CLI reference (condensed)

Install: `gh extension install github/gh-stack` (requires `gh` v2.0+).
Source: https://github.github.com/gh-stack/reference/cli/

## Local stack management

### `gh stack init [flags] [branches...]`

Initialize a stack. With branch names: adopts existing branches, creates missing ones (non-interactive). Without: interactive prompts — avoid. Enables `git rerere` automatically.

- `-b, --base <branch>` — trunk (defaults to repo default branch)

```
gh stack init feature-auth feature-api feature-ui
gh stack init --base develop feature-auth
```

### `gh stack add [flags] [branch]`

Create a branch at HEAD on top of the stack and check it out. Must run from the topmost branch. Without a name (and without `-m`): prompts — pass a name.

- `-A, --all` — stage all changes incl. untracked (requires `-m`)
- `-u, --update` — stage tracked only (requires `-m`; mutually exclusive with `-A`)
- `-m, --message <msg>` — commit before branching; auto-generates branch name (`03-24-add_login`) when no name given

### `gh stack view [flags]`

Show branches, ordering, PR links, latest commit. `-s/--short` compact; `--json` structured output (prefer for parsing).

### `gh stack checkout [<stack-number>|<pr-number>|<pr-url>|<branch>]`

Check out a stack; fetches and sets up remote stacks locally. Bare numbers try stack/PR number first, then branch. No argument: interactive picker — always pass an argument.

### `gh stack modify [flags]`

Interactive TUI to restructure (drop `x`, fold down `d` / up `u`, insert `i`/`I`, move `Shift+↑/↓`, rename `r`, undo `z`; apply `Ctrl+S`). **TUI-only — do not drive blind.** Preconditions: active stack, clean tree, no rebase in progress, no PR queued, linear history. Merged-PR branches locked.

- `--continue` — after resolving apply-phase rebase conflicts
- `--abort` — restore pre-modify state

Non-TUI alternative for restructuring: `gh stack unstack --local` → `gh stack init <new-order...>` → `gh stack submit`.

### `gh stack unstack [<stack-number>] [flags]` (alias: `delete`)

Unstack on GitHub + remove local tracking. No arg: active stack. With number: works from anywhere via API. Merged/merging/queued PRs stay stacked. All PRs removed ⇒ stack dissolved.

- `--local` — remove local tracking only, keep GitHub stack

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

`gh stack switch` (interactive picker — avoid), `gh stack up [n]`, `gh stack down [n]`, `gh stack top`, `gh stack bottom`, `gh stack trunk`. All clamp at stack bounds.

## Misc

- `gh stack alias [name]` — install `gs` (or custom) wrapper in `~/.local/bin/`
- `GH_STACK_THEME` = `auto|light|dark`

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Generic error |
| 2 | Not in a stack / stack not found |
| 3 | Rebase conflict |
| 4 | GitHub API failure |
| 5 | Invalid arguments or flags |
| 6 | Disambiguation required (branch in multiple stacks) |
| 7 | Rebase already in progress |
| 8 | Stack locked by another process |
| 9 | Stacked PRs not enabled for this repository |
