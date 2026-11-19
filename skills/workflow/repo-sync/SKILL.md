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
The only change it makes to a checkout is `git fetch origin <default>` then `git merge --ff-only origin/<default>`. Every git command passes the allowlist in `scripts/git.ts` before a process starts.
Decisions and output are pure TypeScript in `scripts/core/`. All I/O sits behind the `Deps` interface in `scripts/deps.ts`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Command: `run`, `run --dry-run`, `status`, `pause [--reason <text>]`, or `resume`.
2. Optional config. See [Configuration](#configuration).

## Configuration

repo-sync uses the first of: `--config <path>` or `REPO_SYNC_CONFIG` (must exist), `<skill-dir>/config.json` (git-ignored), `${XDG_CONFIG_HOME:-~/.config}/repo-sync/config.json`, then defaults. Copy `config.example.json` to start.

- `accounts`: `[{login, owners?, repos?}]`. A repo maps to an exact `repos` entry, then an `owners` entry, then the one unscoped account. Only HTTPS remotes use it: their fetch gets `GH_TOKEN` from `gh auth token -u <login>`. SSH remotes, including host aliases such as `github.com-work`, use the user's ssh config and get no token.
- `reportChanges`: repos (Orca display name, folder name, or `owner/repo`) whose pulls print their new commits. Default `["tiger-team-sync"]`.

## Workflow

For each repo, in order (Node 22.18+ runs `.ts` directly):

1. Read the current branch. If git cannot read the checkout: `failed (error)`.
2. Require an `origin` remote (`no-remote`) and a default branch: `origin/HEAD`, else the Orca base ref (`no-default-branch`).
3. Require the default branch to be checked out (`not-on-default`) and `git status --porcelain` to be empty, untracked files included (`dirty`).
4. `git fetch origin <default>` (`fetch-failed`).
5. Compare with `origin/<default>`: `diverged`, `ahead`, or up to date.
6. When behind, re-check the branch and `git status --porcelain` (the checkout may change during the fetch), then `git merge --ff-only origin/<default>` (`failed (merge-failed)`). For `reportChanges` repos, collect `git log --oneline` (10 max) and `git diff --name-only` (15 max).

`run --dry-run` stops before steps 4 and 6. It compares with the last fetched `origin/<default>`, prints one line per repo with its auth mode, and writes nothing.

## Scheduling

`run` is built for a scheduler that delivers stdout verbatim, sends nothing for empty stdout, and alerts on a non-zero exit (for example a Hermes cron job with `no_agent`). It prints only:

1. A skip that persists for 2 consecutive runs, once per reason.
2. A fetch failure, failed merge, or unreadable checkout, once when it starts.
3. A pull in a `reportChanges` repo: count, commits, and changed paths.

Quiet successes print nothing. A paused or overlapping run exits 0 with no output. Per-repo problems never fail the run. It exits 1 only when it cannot run at all: invalid config, no repo list from Orca and no cached list, or unwritable state. Every child process has a 60-second timeout.

## State

`${XDG_STATE_HOME:-~/.local/state}/repo-sync/` (`--state-dir` overrides):

- `last-run.json`: last result per repo with streak count. `repo-sync status` prints it.
- `events.jsonl`: every pull, the first run of each skip or failure, and a run summary.
- `repos.json`: last good Orca repo list, used when `orca-ide` cannot answer.
- `lock`: held during `run`. A lock whose process is gone, or older than 30 minutes, is taken over.
- `paused`: present after `repo-sync pause`; removed by `repo-sync resume`.

## Safety Rules

- Never run a git command outside the allowlist: `rev-parse`, `status --porcelain`, `fetch origin <branch>`, `merge --ff-only origin/<branch>`, `rev-list --left-right --count`, `log --oneline`, `diff --name-only`.
- Never reset, stash, rebase, check out, clean, push, force, or fetch other branches or remotes.
- Never run `gh auth switch` or write credentials.
- Use `orca-ide`, never bare `orca` (the GNOME screen reader on some desktops).
- Never create, edit, or remove scheduler jobs unless the user asks.

## Output Style

Relay `run` output as-is. Empty output means nothing needs attention. For `status` and `--dry-run`, list the repos that need the user's action first.

Command: `node <skill-dir>/scripts/repo-sync.ts <command>`. Tests: `npm test` in the skill directory.
