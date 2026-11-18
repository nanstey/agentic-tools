---
name: prflow
description: Scans open PRs, review requests, and leftover worktrees, then reports each item grouped by status and next action. Use when checking which PRs need a merge decision, a rerun, a CI or comment fix, a rebase, a review, or worktree cleanup.
argument-hint: "[scan|plan] [--format text|json|legacy] [--owner <login>] [--all-owners] [--no-worktrees]"
user-invocable: true
disable-model-invocation: false
---

# prflow

## Core Contract

Run the `prflow` CLI and relay its report. Phase 1 is read-only: it fetches and classifies, it never dispatches sessions, writes to GitHub, or changes Orca.
Classification is pure TypeScript in `scripts/core/`. All I/O sits behind the `Deps` interface in `scripts/scan.ts`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Command: `scan` (facts) or `plan` (classified report). Default `plan`.
2. Optional scope flags. Default: `noelcf`, owner `Checkfront`, worktrees included.

## Workflow

1. Run `node <skill-dir>/scripts/prflow.ts plan` (Node 22.18+ runs `.ts` directly).
2. Relay the grouped report. Report `warn:` lines from stderr as scan gaps.
3. For raw facts, run `scan`. For machine output, add `--format json`.
4. To compare with the legacy precheck, run `plan --format legacy --all-owners --no-worktrees`. It prints `<repo>#<n>@<head8>:<kind>[:<detail>]` lines without any dedupe ledger.

## Classifier

One kind per PR, in priority order:

| Kind | Trigger | Next action | Owner |
| --- | --- | --- | --- |
| `merge-ready` | CLEAN, APPROVED, checks finished with no failure or cancel | Notify Noel. Never merge | you |
| `rerun` | Cancelled jobs, or only `required-action(s)-checker` failed, nothing pending | `gh run rerun --failed` | prflow |
| `ci` | A real check failed, nothing pending | CI fix brief | Pi session |
| `comments` | Human comment, review body, changes request, or unresolved thread newer than the head commit, with no later reply from `me` | Fix-and-reply brief | Pi session |
| `behind` | BEHIND or DIRTY, nothing pending | Rebase brief | Pi session |
| `review-requested` | `me` is requested, not draft, required checks finished, head not yet reviewed by `me` | Reviewer session, draft only | Pi reviewer |
| `cleanup` | Orca worktree whose PR is merged or closed | Archive if clean, else Noel checks | prflow or you |
| `waiting` | Anything else | None | others |

Author PRs keep every legacy trigger in `triggers`. Rules port `~/.local/state/pr-comment-watch/precheck.sh` exactly, with two divergences where legacy crashed and printed nothing for any PR: pending reviews with no timestamp are ignored, and a PR with no commits is skipped. `tests/legacy/precheck.sh` is an unmodified copy used by the parity tests.

## Development

- `npm install` once, then `npm test` (strict `tsc --noEmit`, then `node --test`).
- Fixtures live in `tests/fixtures.ts` and feed both prflow and the legacy script.

## Safety Rules

- Never call `gh auth switch`. Every `gh` call uses `GH_TOKEN` from `gh auth token -u <me>`.
- Never run a `gh` command outside the read-only allowlist in `assertReadOnly` (`scripts/adapters/gh.ts`).
- Never merge, approve, comment, rerun, or archive from phase 1. Report the next action only.
- Never edit `~/.local/state/pr-comment-watch` or `~/.local/state/pr-watch`.

## Output Style

Relay the report groups in order: Needs your decision, Ready to act, Blocked on others, Cleanup. One row per item: `repo#PR`, title, kind and status, next action, owner. Print "Nothing to report." when empty.
