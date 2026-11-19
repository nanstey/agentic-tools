---
name: prflow
description: Scans open PRs, review requests, and leftover worktrees, records them in local state behind safety rails, optionally reruns cancelled CI and archives clean worktrees, and reports each item grouped by status and next action. Use when checking which PRs need a merge decision, a rerun, a CI or comment fix, a rebase, a review, or worktree cleanup, when pausing or inspecting prflow, or when scheduling a recurring PR watch or tick.
argument-hint: "[scan|plan|watch|tick|status|pause|resume|import-legacy|config] [--config <path>] [--user <login>] [--owner <login>] [--repo <owner/repo>] [--format text|json] [--no-worktrees] [--item <owner/repo#N>] [--all] [--dry-run]"
user-invocable: true
disable-model-invocation: false
---

# prflow

## Core Contract

Run the `prflow` CLI and relay its output. prflow fetches and classifies PRs, records them in its own state, and enforces rails. Its only side effects are the two safe actions in [Actions](#actions), and only when the config enables them. It never dispatches sessions.
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

## Actions

`prflow tick` takes two actions. Both are dry runs unless the config sets `"actions": {"dryRun": false}`; `tick --dry-run` forces a dry run either way. A dry run makes the same read-only checks and announces each action once per item version as a `dry-run` event.

| Kind | Action | Preconditions | Otherwise |
| --- | --- | --- | --- |
| `rerun` | `gh run rerun <run-id> --failed -R <owner/repo>` for each GitHub Actions run behind a cancelled job | No PR check pending, and `gh run view` reports every run `completed`. At most `rails.rerunsPerVersion` (default 2) reruns per item version | Waits; asks you (`needs-decision`) when no Actions run can be found; pauses the item when the checks are cancelled again after the last rerun |
| `cleanup` | `orca-ide worktree rm --worktree path:<path> --json`; for a merged PR, then `git --git-dir <repo> update-ref -d refs/heads/<branch> <sha>` (local branch only; deleted only while it still points at the checked commit and no worktree has it) | PR merged or closed, `git status --porcelain` empty, and no commits outside the remotes unless HEAD is the PR head or its ancestor | Asks you (`needs-decision`) once; never archives. Keeps a closed PR's branch, and a merged PR's branch when HEAD is detached or on another branch |

Each live action writes its dispatch row and a `dispatched` event before the command, then records `done` with a `rerun` or `archived` event, or `failed` with `action-failed`. An interrupted action is settled or marked stale on the next tick. All rails apply.

## State and Rails

State lives in `${XDG_STATE_HOME:-~/.local/state}/prflow/` (`--state-dir` overrides). See `references/state.md` for the files, tables, event format, dispatch lifecycle, and rails.

- `prflow status [--format json]`: items from the last scan, open dispatches with leases, pauses, backoff, and the last tick.
- `prflow pause [--all] [--reason <text>]` pauses prflow: `tick` stops completely until `prflow resume`. `prflow pause --item <owner/repo#N>` pauses one item.
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

An approval whose body asks for no changes (no "changes needed", "changes requested", "request changes", or "please fix") is informational: it never triggers `comments`, and the report row shows its body as a `note:`. Unresolved threads still trigger on their own.

Pending reviews with no timestamp are ignored, and a PR with no commits is skipped.

## Development

- `npm install` once, then `npm test` (strict `tsc --noEmit`, then `node --test`).
- Fixtures live in `tests/fixtures.ts`.

## Safety Rules

- Never call `gh auth switch`. Each account's `gh` calls use `GH_TOKEN` from `gh auth token -u <login>`. Only the active account may fall back to ambient auth.
- Never commit `config.json`. Only `config.example.json` is tracked.
- Never run a `gh` command outside the read-only allowlist in `assertReadOnly` and the rerun allowlist in `assertRerun` (`scripts/adapters/gh.ts`).
- Never merge, approve, comment, force-push, or dismiss reviews.
- Never run a GitHub write other than `gh run rerun <id> --failed -R <owner/repo>` (`assertRerun`), and never while any check is running.
- Never run an Orca write other than `orca-ide worktree rm --worktree path:<path> --json` (`assertArchive`): no `--force`, no `--delete-branch`. Never archive a worktree with uncommitted files or unpushed commits.
- Never run a git write other than `git --git-dir <abs> update-ref -d refs/heads/<branch> <sha>` (`assertDeleteBranch`, `scripts/adapters/git.ts`), and only for a merged PR's branch after its worktree is archived. Never delete a remote branch.
- Never turn off dry run (`actions.dryRun`) without the user's request.
- Never edit files in the prflow state directory by hand; use `pause`, `resume`, and `import-legacy`.
- Never write to the legacy `pr-comment-watch` or `pr-watch` state directories.
- Run Orca as `orca-ide`, never bare `orca` (on some Linux desktops that is the GNOME screen reader).

## Output Style

Relay the report groups in order: Needs your decision, Ready to act, In flight, Blocked on others, Cleanup. Relay a tick's `## New events` lines before the report. One row per item: `repo#PR`, title, kind and status, next action, owner, and the account when more than one is configured. Print "Nothing to report." when empty.
