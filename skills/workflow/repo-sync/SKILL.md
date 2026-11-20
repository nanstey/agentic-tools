---
name: repo-sync
description: Keeps the main checkout of every Orca-tracked repo current by fast-forwarding it to origin's default branch only when it is clean, on that branch, and not ahead, and reports only stuck checkouts, failures, and pulls in selected repos. Use when updating local main checkouts, checking why a checkout is not updating, pausing or resuming repo-sync, or scheduling a recurring sync.
argument-hint: "[run|run --dry-run|status|pause|resume] [--config <path>] [--state-dir <path>] [--reason <text>] [--format json]"
user-invocable: true
disable-model-invocation: false
---

# repo-sync

## Core Contract

Run the `repo-sync` CLI and relay its output. It updates the main checkout (the repo `path` Orca tracks, never other worktrees) of each local git repo from `orca-ide repo list --json`. It skips folder workspaces, hidden repos, and repos on another execution host.
The only change it makes to a checkout is `git fetch origin <default>` then `git merge --ff-only --no-overwrite-ignore refs/remotes/origin/<default>`. Every git command is built in `scripts/git.ts`, whose builders reject unsafe branch names and SHAs. All I/O sits behind the `Deps` interface in `scripts/deps.ts`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Command: `run`, `run --dry-run`, `status`, `pause [--reason <text>]`, or `resume`.
2. Optional config. See [Configuration](#configuration).

## Configuration

repo-sync, prflow, and orca-task-status read one shared file, selected by `--config <path>` or `AGENTIC_TOOLS_CONFIG` (the file must exist), then `<repo-root>/config.json`, then `${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json`. Copy the repository's `config.example.json` to `<repo-root>/config.json` or the XDG path to start. Accounts are top-level and shared; besides them, repo-sync reads only `repoSync.reportChanges`. Each tool ignores top-level sections it does not own but rejects unknown keys inside its own section and in `accounts`. A repo maps to an exact `repos` entry, then an `owners` entry, then the one unscoped account. Only `https://github.com/...` remotes use an account, judged from the checkout's `git remote get-url origin`: their fetch gets `GH_TOKEN` from `gh auth token -u <login>`. Other HTTPS hosts and `http://` use ambient credentials. SSH remotes, including host aliases such as `github.com-work`, use the user's ssh config and get no token.

## Workflow

For each repo, in order (Node 22.18+ runs `.ts` directly):

1. Read the current branch. If git cannot read the checkout: `failed (error)`.
2. Require an `origin` remote (`no-remote`) and a default branch: `origin/HEAD`, else the Orca base ref (`no-default-branch`). If origin's default branch changed, the local `origin/HEAD` stays stale until `git remote set-head origin --auto`; the stuck notice says so.
3. Require the default branch to be checked out (`not-on-default`), no `index.lock` (`locked`: a git command is running or was interrupted; repo-sync never removes the lock), and `git --no-optional-locks status --porcelain` to be empty, untracked files included (`dirty`).
4. `git fetch origin <default>` (`fetch-failed`).
5. Compare with `origin/<default>`: `diverged`, `ahead`, or up to date (`no-remote` if it cannot be resolved).
6. When behind, re-check the branch, the lock, and `git --no-optional-locks status --porcelain` (the checkout may change during the fetch), then `git merge --ff-only --no-overwrite-ignore refs/remotes/origin/<default>`. `--no-overwrite-ignore` refuses to overwrite ignored local files such as `.env`. A refused merge changes nothing (`failed (merge-failed)`). The merge is never SIGKILLed: after 30 minutes it gets SIGTERM, so git removes its own `index.lock`. A merge that stops partway and leaves a lock or changed paths is `failed (merge-interrupted)`, with what it left and the unchanged HEAD; the next runs skip the checkout as `dirty` or `locked` until the user cleans up. For `reportChanges` repos, collect `git log --oneline` (10 max) and `git diff --name-only` (15 max).

`run --dry-run` stops before steps 4 and 6. It compares with the last fetched `origin/<default>`, prints one line per repo with its auth mode, and writes nothing.

## Scheduling

`run` is built for a scheduler that delivers stdout verbatim, sends nothing for empty stdout, and alerts on a non-zero exit. It prints only:

1. A skip that persists for 2 consecutive runs, once per reason.
2. A fetch failure, failed or interrupted merge, or unreadable checkout, once when it starts.
3. A pull in a `reportChanges` repo: count, commits, and changed paths.

Quiet successes print nothing. A paused or overlapping run exits 0 with no output. Per-repo problems never fail the run. It exits 1 only when it cannot run at all: invalid config, no repo list from Orca and no cached list, or unwritable state. Bad usage (unknown commands or invalid flags) exits 2. Every child process except the merge is SIGKILLed after 60 seconds; the merge gets 30 minutes, then SIGTERM.

## State

`${XDG_STATE_HOME:-~/.local/state}/repo-sync/` (`--state-dir` overrides):

- `last-run.json`: last result per repo with streak count. `repo-sync status` prints it.
- `events.jsonl`: every pull, the first run of each skip or failure, and a run summary.
- `repos.json`: last good Orca repo list, used when `orca-ide` cannot answer.
- `lock`: held during `run`. A lock whose process is gone is taken over immediately. An unreadable lock is taken over only after 30 minutes; a live process is never taken over based on age.
- `paused`: present after `repo-sync pause`; removed by `repo-sync resume`.

## Safety Rules

- Git commands are limited to: `rev-parse` (including `--git-path index.lock`), `--no-optional-locks status --porcelain`, `remote get-url origin`, `fetch origin <branch>`, `merge --ff-only --no-overwrite-ignore refs/remotes/origin/<branch>`, `rev-list --left-right --count`, `log --oneline`, `diff --name-only`. Remote-tracking refs are spelled in full, so a tag or branch named `origin/<branch>` cannot shadow them.
- Git children run without `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and the other location variables a git hook sets, so each command acts on the checkout it names.
- Never reset, stash, rebase, check out, clean, push, force, remove git locks, or fetch other branches or remotes.
- Never run `gh auth switch` or write credentials.
- Use `orca-ide`, never bare `orca` (the GNOME screen reader on some desktops).
- Never create, edit, or remove scheduler jobs unless the user asks.

## Output Style

Relay `run` output as-is. Empty output means nothing needs attention. For `status` and `--dry-run`, list the repos that need the user's action first.

Command: `node <skill-dir>/scripts/repo-sync.ts <command>`. Tests: `npm install` once at the repository root (an npm workspace), then `npm test` in the skill directory.
