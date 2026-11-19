---
name: prflow
description: Scans open PRs, review requests, and leftover worktrees, records them in local state behind safety rails, and reports each item grouped by status and next action. Use when checking which PRs need a merge decision, a rerun, a CI or comment fix, a rebase, a review, or worktree cleanup, when pausing or inspecting prflow, or when scheduling a recurring PR watch or tick.
argument-hint: "[scan|plan|watch|tick|status|pause|resume|import-legacy|config] [--config <path>] [--user <login>] [--owner <login>] [--repo <owner/repo>] [--format text|json] [--no-worktrees] [--item <owner/repo#N>] [--all]"
user-invocable: true
disable-model-invocation: false
---

# prflow

## Core Contract

Run the `prflow` CLI and relay its output. prflow fetches and classifies PRs, records them in its own state, and enforces rails. It never dispatches sessions, writes to GitHub, or changes Orca.
Classification, rails, and report logic are pure TypeScript in `scripts/core/`. All I/O sits behind the `Deps` interface in `scripts/scan.ts` (`TickDeps` in `scripts/tick.ts`).
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Command: `scan` (facts), `plan` (classified report), `watch` (scheduled change report), `tick` (scheduled scan, reconcile, and feed), `status`, `pause`, `resume`, `import-legacy`, or `config` (resolved accounts). Default `plan`.
2. Optional accounts config. See [Configuration](#configuration).

## Configuration

prflow uses the first of these:

1. `--user <login>`, with optional `--owner` and `--repo` scope. Config files are ignored.
2. `--config <path>` or `PRFLOW_CONFIG`. The file must exist.
3. `<skill-dir>/config.json` (git-ignored).
4. `${XDG_CONFIG_HOME:-~/.config}/prflow/config.json`.
5. The active `gh` account, with optional `--owner` and `--repo` scope. Flag scope skips steps 3 and 4.

Copy `config.example.json` to start. Each account has a `login` and optional `owners` and `repos` (`owner/repo`). An account with neither covers every repo no other account claims; at most one may do so. A repo maps to one account: an exact `repos` entry first, then an `owners` entry, then the unscoped account. So a `repos` entry can move one repo out of another account's owner. Each account searches only its scope, and hits in repos owned by another account are dropped. Worktrees in repos no account covers are skipped. Every account must be logged in to `gh` (`gh auth login`). Run `prflow config` to check the result.

An optional `rails` object sets tick limits; missing keys keep their defaults: `startsPerTick` 2, `maxOpen` 5, `perHour` 6, `perDay` 30, `loopSameVersion` 3, `loopAcrossVersions` 8, `backoffBaseMinutes` 15, `backoffMaxMinutes` 240, `pollBudgetSeconds` 120, `childTimeoutSeconds` 60, `leaseMinutes` 45, `maxAttempts` 3.

## Workflow

1. Run `node <skill-dir>/scripts/prflow.ts plan` (Node 22.18+ runs `.ts` directly).
2. Relay the grouped report. Report `warn:` lines from stderr as scan gaps. Each starts with the account it ran as.
3. For raw facts, run `scan`. For machine output, add `--format json`.

## Scheduling

prflow is scheduler- and agent-agnostic. `prflow watch` prints the actionable report only when it changed since the last run, prints nothing otherwise, and exits 1 on scan errors without saving state. `prflow tick` does the same scan, records state, applies the rails, and prints new events before the report. To set up a recurring job on cron, systemd, Hermes, or any other scheduler, follow `references/scheduling.md`.

## State and Rails

State lives in `${XDG_STATE_HOME:-~/.local/state}/prflow/` (`--state-dir` overrides). See `references/state.md` for the files, tables, event format, dispatch lifecycle, and rails.

- `prflow status [--format json]`: items from the last scan, open dispatches with leases, pauses, backoff, and the last tick.
- `prflow pause [--all] [--reason <text>]` pauses prflow; `prflow pause --item <owner/repo#N>` pauses one item.
- `prflow resume` resumes prflow, `--item` one item, `--all` prflow and every paused item.
- `prflow import-legacy` copies the legacy `pr-comment-watch` and `pr-watch` `dispatched.txt` entries into the ledger once. It only reads those files.
- Run these on the user's request. Never edit state files by hand.

## Classifier

One kind per PR, in priority order:

| Kind | Trigger | Next action | Owner |
| --- | --- | --- | --- |
| `merge-ready` | CLEAN, APPROVED, checks finished with no failure or cancel | Tell you it is ready. Never merge | you |
| `rerun` | Cancelled jobs, no failures, nothing pending | `gh run rerun --failed` | prflow |
| `ci` | Any check failed, nothing pending | CI fix brief; the session follows the repo's CI docs | agent |
| `comments` | Human comment, review body, changes request, or unresolved thread newer than the head commit, with no later reply from `me` | Fix-and-reply brief | agent |
| `behind` | BEHIND or DIRTY, nothing pending | Rebase brief | agent |
| `review-requested` | `me` is requested, not draft, required checks finished, head not yet reviewed by `me` | Reviewer session, draft only | agent reviewer |
| `cleanup` | Orca worktree whose PR is merged or closed | Archive if clean, else you check | prflow or you |
| `waiting` | Anything else | None | others |

Author PRs list every trigger that fired in `triggers`. prflow encodes no repo-specific rules: every check counts the same, and caveats such as a job that only needs a rerun belong in that repo's own docs.

Pending reviews with no timestamp are ignored, and a PR with no commits is skipped.

## Development

- `npm install` once, then `npm test` (strict `tsc --noEmit`, then `node --test`).
- Fixtures live in `tests/fixtures.ts`.

## Safety Rules

- Never call `gh auth switch`. Each account's `gh` calls use `GH_TOKEN` from `gh auth token -u <login>`. Only the active account may fall back to ambient auth.
- Never commit `config.json`. Only `config.example.json` is tracked.
- Never run a `gh` command outside the read-only allowlist in `assertReadOnly` (`scripts/adapters/gh.ts`).
- Never merge, approve, comment, rerun, or archive. Report the next action only.
- Never edit files in the prflow state directory by hand; use `pause`, `resume`, and `import-legacy`.
- Never write to the legacy `pr-comment-watch` or `pr-watch` state directories.
- Run Orca as `orca-ide`, never bare `orca` (on some Linux desktops that is the GNOME screen reader).

## Output Style

Relay the report groups in order: Needs your decision, Ready to act, In flight, Blocked on others, Cleanup. Relay a tick's `## New events` lines before the report. One row per item: `repo#PR`, title, kind and status, next action, owner, and the account when more than one is configured. Print "Nothing to report." when empty.
