---
name: prflow
description: "Watches open PRs, review requests, and leftover worktrees across accounts: classifies each, keeps a ledger behind safety rails, keeps worktree board columns in step with their PRs, unblocks Blocked cards, archives unused merged worktrees, and hands PR work and review drafting to Pi sessions that run the `pr` skill. Use when asking which PRs need attention, running or scheduling a tick, managing dispatches and pauses, or listing and showing review drafts."
argument-hint: "[scan|plan|watch|tick|status|pause|resume|recover <id>|review list|review show <draft-id>|import-legacy|config] [--config <path>] [--user <login>] [--owner <login>] [--repo <owner/repo>] [--format text|json] [--no-worktrees] [--item <owner/repo#N>] [--all] [--dry-run]"
user-invocable: true
disable-model-invocation: false
---

# prflow

## Core Contract

prflow states GitHub facts and hands PR work to `/pr`; it does not restate PR rules. Tick makes no GitHub writes.

Run the `prflow` CLI and relay its output. prflow fetches and classifies PRs, records them in its own state, and enforces rails. Its enabled side effects are archiving eligible worktrees ([Actions](#actions)), moving Blocked cards ([Unblock](#unblock)), updating board columns ([Worktree Status](#worktree-status)), Pi dispatches ([Pi Dispatch](#pi-dispatch)), and reviewer sessions ([Review Drafts](#review-drafts)). prflow never writes to GitHub PR content. A review draft reaches GitHub only through `/pr review <pr_url>` with the saved draft as the matching packet.
Classification, rails, and report logic are pure TypeScript in `scripts/core/`. All I/O sits behind the `Deps` interface in `scripts/scan.ts` (`TickDeps` in `scripts/tick.ts`). Pi dispatch lives in `scripts/agents.ts`, unblocking in `scripts/unblock.ts`, worktree column sync in `scripts/worktree-status.ts` (rules in `scripts/core/worktree-status.ts`), the review flow in `scripts/review.ts`, and the review commands in `scripts/review-cmd.ts`; briefs render in `scripts/core/brief.ts`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Command: `scan` (facts), `plan` (classified report), `watch` (scheduled change report), `tick` (scheduled scan, reconcile, and feed), `status`, `pause`, `resume`, `recover <dispatchId>`, `review list|show`, `import-legacy`, or `config` (resolved accounts). Default `plan`.
2. Optional accounts config. See [Configuration](#configuration).

## Configuration

prflow uses the first of these:

1. `--user <login>`, with optional `--owner` and `--repo` scope. Config files are ignored.
2. `--config <path>` or `AGENTIC_TOOLS_CONFIG`. The file must exist.
3. `<repo-root>/config.json` (git-ignored).
4. `${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json`.
5. The active `gh` account, with optional `--owner` and `--repo` scope. Flag scope skips steps 3 and 4.

Copy the repository's `config.example.json` to `<repo-root>/config.json` or the XDG path to start. prflow reads its options from the `prflow` section; accounts are shared at the top level. Each account has a `login` and optional `owners` and `repos` (`owner/repo`). An account with neither covers every repo no other account claims; at most one may do so. A repo maps to one account: an exact `repos` entry first, then an `owners` entry, then the unscoped account. So a `repos` entry can move one repo out of another account's owner. Each account searches only its scope, and hits in repos owned by another account are dropped. Worktrees in repos no account covers are skipped. Review worktrees are scanned for archive after their PR closes or merges. Every account must be logged in to `gh` (`gh auth login`). Run `prflow config` to check the result.

Options live inside the `prflow` section: `prflow.limit`, `prflow.worktrees`, `prflow.rails`, `prflow.actions`, `prflow.dispatch`, `prflow.review`, and `prflow.worktreeStatus`. An optional `prflow.rails` object sets tick limits; missing keys keep their defaults: `startsPerTick` 2, `maxOpen` 5, `perHour` 6, `perDay` 30, `loopSameVersion` 3, `loopAcrossVersions` 8, `backoffBaseMinutes` 15, `backoffMaxMinutes` 240, `pollBudgetSeconds` 120, `childTimeoutSeconds` 60, `leaseMinutes` 45, `maxAttempts` 3, `busyWaitMinutes` 45.

An optional `prflow.dispatch` object controls [Pi Dispatch](#pi-dispatch): `prflow.dispatch.dryRun` (default `true`, separate from `prflow.actions.dryRun`) and `prflow.dispatch.projectContext`, a list of `{path, folder, repos, owners}`. A brief for a PR in one of `repos`, or in any repo of one of `owners` (an exact `repos` entry wins), tells the agent to read `<path>/AGENTS.md` and `<path>/<folder>/AGENTS.md` for how the PR relates to other work.

An optional `prflow.worktreeStatus` object controls [Worktree Status](#worktree-status): `prflow.worktreeStatus.dryRun` (default `true`, separate from the other dry runs) and `prflow.worktreeStatus.ignore` (repos by Orca folder name, repo name, or `owner/repo`, case-insensitive; default `[]`). The shared `orchestrator.ignore` list is added to it.

[Unblock](#unblock) and [Worktree Status](#worktree-status) read the Orca board status ids from the shared `taskStatus.statuses` section (the one orca-task-status uses). It runs only when `taskStatus.statuses.blocked` is set.

An optional `prflow.review` object controls [Review Drafts](#review-drafts): `prflow.review.dryRun` (default `true`), `prflow.review.maxConcurrent` (default 2), `prflow.review.sessionReviews` (default 5), `prflow.review.idleCloseHours` (default 24), and `prflow.review.statuses` (Orca status ids for draft, reviewing, changes, and approved).

## Workflow

1. Run `node <skill-dir>/scripts/prflow.ts plan` (Node 22.18+ runs `.ts` directly).
2. Relay the grouped report. Report `warn:` lines from stderr as scan gaps. Each starts with the account it ran as.
3. For raw facts, run `scan`. For machine output, add `--format json`.

## Scheduling

prflow is scheduler- and agent-agnostic. `prflow watch` prints the actionable report only when it changed since the last run, prints nothing otherwise, and exits 1 on scan errors without saving state. `prflow tick` does the same scan, records state, applies the rails, and prints new events before the report. To set up a recurring job on cron, systemd, Hermes, or any other scheduler, follow `references/scheduling.md`.

## Actions

`prflow tick` takes one action. It is a dry run unless the config sets `prflow.actions.dryRun` to `false`; `tick --dry-run` forces a dry run either way. A dry run makes the same read-only checks and announces each action once per item version as a `dry-run` event.

| Kind | Action | Preconditions | Otherwise |
| --- | --- | --- | --- |
| `cleanup` | For ordinary worktrees, archive a clean merged/closed PR and delete the local branch only for merged PRs. For persistent `prflow-review/` worktrees, require a clean tree and no busy/open or unowned Pi session, close only idle prflow-launched terminals, archive on close/merge, and delete the local branch for either state. | PR merged or closed; review worktrees also require all Pi sessions verified and owned | Asks you (`needs-decision`) once; never archives dirty worktrees or review worktrees with busy, open, or unowned Pi sessions |

Each live action writes its dispatch row and a `dispatched` event before the command, then records `done` with an `archived` event, or `failed` with `action-failed`. An interrupted action is settled or marked stale on the next tick. All rails apply.

## Unblock

An agent that sets its worktree Blocked records why and what must be true to unblock it (orca-task-status `--reason` and `--until`). The records live in `${XDG_STATE_HOME:-~/.local/state}/agentic-tools/blocked.json`. Each `prflow tick` with worktrees enabled checks every Orca worktree whose status is the configured Blocked id:

1. **Skip:** review worktrees (`prflow-review/`), cards in any other column (Paused included), and repos no account covers.
2. **No record, or only `manual`:** `needs-decision` once ("blocked with no unblock condition"). prflow never moves these cards.
3. **Evaluate** each condition with read-only `gh` calls as the repo's account: the branch PR (`PR_QUERY`, which marks required checks) for `checks-pass` and `pr-approved`, and `gh pr view <n> -R <owner/repo> --json state` for `pr-merged`. A record whose only condition is `checks-pass` holds whenever the branch PR is open, including when checks are pending, failing, or cancelled; waiting for CI is In Review, not Blocked. A failed read waits for the next tick. A `pr-merged` PR closed unmerged, or a branch PR that closed, gets one `needs-decision`.
4. **Move out** when every condition holds. The target is the state orca-task-status `end` would set from the PR and the worktree (`prDecision` in `lib/task-status.ts`): for example Done when the PR is ready to merge, In Review while it waits, or Needs Attention when the local HEAD differs or no PR exists. prflow re-reads the worktree list right before the write and skips a card that already left Blocked. Then it runs `orca-ide worktree set --worktree id:<id> --workspace-status <id> --comment "unblocked: <what changed>" --unread --json` (such as `unblocked: checks passed at 1a2b3c4d`), removes the record, and emits `unblocked`. A target state with no configured status id gets one `needs-decision` instead.

Moves are dry runs unless `prflow.actions.dryRun` is `false`; `tick --dry-run` forces a dry run. A dry run announces each move once as a `dry-run` event. A live move is a dispatch of kind `unblock` per record (version `blocked@<set time>`), so pauses, caps, the loop breaker, retries, and dedup apply as for the other actions.

## Worktree Status

Each `prflow tick` with worktrees enabled sets every development worktree's Orca board column from its state, after the other actions:

| State | Column |
| --- | --- |
| An agent session in the worktree is `working` (`orca-ide agent list`, any agent), or an open prflow dispatch targets it. Wins over every row below | In Progress |
| PR merged, or open with no failing, pending, or cancelled checks; empty or `APPROVED` review decision; merge state `CLEAN` or `HAS_HOOKS` | Done |
| PR closed unmerged, or open with a failing check, `DIRTY`, `CHANGES_REQUESTED`, or unanswered review feedback | Needs Attention |
| Any other open PR, including pending or cancelled checks | In Review |
| No PR, or a draft PR, and nothing running | Left as is |

The open-PR board rule is shared with orca-task-status in `lib/pr-state.ts` (`prColumn`); prflow supplies its unanswered-feedback result. The PR is the scanned open PR linked to the worktree in Orca, else the one on its branch, or the closed PR the cleanup scan found. Status ids come from `taskStatus.statuses` (`in-progress`, `in-review`, `done`, `needs-attention`); a target with no id gets one `needs-decision`.

- **Skip:** the main checkout, review worktrees (`prflow-review/`, which [Review Drafts](#review-drafts) keep in their own columns), cards in the Blocked or Paused column, repos no account covers, ignored repos (see [Configuration](#configuration)), and items paused with `prflow pause --item`. An unreadable agent list moves nothing that tick.
- **Write:** only when the column changes, as `orca-ide worktree set --worktree id:<id> --workspace-status <id> --json`. The card's comment and unread flag stay. Each move emits a `worktree-status` event (`<path>: <old> -> <new> (<reason>)`); a failed write emits one `action-failed` per target and is retried each tick.
- **Dry run:** unless the config sets `prflow.worktreeStatus.dryRun` to `false`, or with `tick --dry-run`, each move is only announced, once per change, as a `dry-run` event.

## Pi Dispatch

`prflow tick` sends a brief for each own PR whose kind is `ci`, `comments`, or `behind` to a Pi session in the PR's Orca worktree. Briefs are versioned templates in `templates/briefs/` (`ci.md`, `comments.md`, `behind.md`, `nudge.md`, and `restart.md`, which wraps a brief for a session prflow restarts in place). Each one holds the PR URL, trigger details, and the `/pr <url>` handoff, and ends with the no-self-edit note.

Nothing is launched or messaged unless the config sets `prflow.dispatch.dryRun` to `false`; `tick --dry-run` forces a dry run either way. A dry run makes the same reads and announces the exact target and brief once per item version as a `dry-run` event.

1. **Worktree:** the Orca worktree linked to the PR, else the one on its head branch. None or several: `needs-decision` once; prflow never creates a worktree for these briefs.
2. **Busy check:** prflow reads the worktree's Pi sessions (`orca-ide agent list`, `terminal list`). If any is working, blocked, waiting, or of unknown state, the dispatch stays `planned` and is retried next tick. After `busyWaitMinutes` (45) a lone busy Pi terminal is interrupted with Escape (`interrupted`) and, once its prompt is back, gets the brief in the same session with a request for an immediate status update first. Several busy sessions, or a busy chat, are never interrupted; the dispatch goes `stale` one lease later.
3. **Target:** an idle Pi session gets the brief by `orca-ide orchestration send`; with none, prflow launches a fresh Pi (`orca-ide agent launch --agent pi --surface terminal`). One agent dispatch per item at a time.
4. **Monitor:** each tick renews the lease while the session shows new activity, and records `done` with a `session-finished` event (the session's last message, truncated) once the session is idle or gone and the PR moved on (new head, new feedback, or the trigger is gone). Becoming a draft does not end an open dispatch; drafts with no dispatch have no author triggers.
5. **Recovery:** idle with the work unfinished gets one nudge (`nudged`). Idle again, closed, still busy `busyWaitMinutes` after the brief, or a lease that ran out marks the dispatch `stale` (`session-stale`). The next attempt carries the same brief plus what the last attempt left. After a busy session it interrupts that session and restarts it in place, asking for an immediate update first; otherwise it closes the session and launches a fresh one. After `maxAttempts` the dispatch is `abandoned`, the item is paused, and prflow emits `abandoned` and `paused`.
6. **Crash safety:** the row and an event are written before every launch, message, nudge, and close. A `launched` row with no recorded session adopts the Pi session that appeared since (`recovered`).

The lifecycle and every event are in `references/dispatch.md`.

## Review Drafts

`prflow tick` reviews each new head found through requested-reviewer or reviewed-by search in one persistent Orca worktree per PR; PRs authored by the searched account are excluded from reviewed-by results. Dispatches and drafts remain per head. The reviewer writes a draft and posts nothing. Nothing is created or launched unless the config sets `prflow.review.dryRun` to `false`; `tick --dry-run` forces a dry run. A dry run makes the same reads and announces the exact target and brief once per head as a `dry-run` event.

1. **Dedupe:** one dispatch per (item, head sha8, `review-requested`). A new head is a new version and a new review, started once the previous reviewer of that PR settles. Requests another human already approved (no changes requested) are `low priority (already approved by <login>)` and start after the others.
2. **Worktree:** one per PR: `orca-ide worktree create --repo id:<repoId> --name prflow-review-<repo>-<n> --branch prflow-review/<repo>-<n> --pr <n> --no-parent --setup run --json`, run without the caller's Orca identity (`ORCA_TERMINAL_HANDLE`, `ORCA_AGENT_SESSION_ID`, and the other caller variables in `detachedEnv`) so it is top-level in its repo even when a bot chat runs `tick`; if Orca still reports a parent, prflow drops it with `worktree set --no-parent`. It then links the worktree with `worktree set --pr <n>`, because `create --pr` leaves Orca's `linkedPR` empty and Orca shows no PR card; status sync links any existing review worktree that still lacks it. The repo id comes from Orca's main worktree. Before each head, prflow checks no session is busy and the tree is clean, then fetches `pull/<n>/head`, resets to the exact SHA, and verifies HEAD. Dirty worktrees get one `needs-decision`; fetch/reset/verify failures retry normally. The row and event are written before git writes. Once the reviewer is launched or messaged, prflow sets the worktree to `prflow.review.statuses.reviewing`, comment `reviewing <head8>`, in the same tick.
3. **Brief:** confirm the prepared worktree HEAD, run `/pr review <url> report` as a full `review-code` review (each required row and the candidate verifier as its own `Agent` child, never a self-review), and write its verdict, coverage, summary, inline comments, notes, and verbatim report output to `${state}/drafts/<owner>-<repo>-<n>/<head8>/review.md` using the parseable format in the review brief. Project-context repos get a read-only pointer to the shared docs. A review that could not run every required child is saved as `Coverage: incomplete (...)` with Verdict `comment`, and prflow shows it as incomplete in the event, report, status comment, and `review list`.
4. **Monitor:** as for Pi dispatch, but a busy reviewer is never stopped for `busyWaitMinutes`; only the lease (renewed on activity) applies. Done once a parseable draft is saved (`review-drafted`: draft id, verdict suggestion, comment count, path). Idle without a draft: one nudge (`templates/briefs/review-nudge.md`), then stale and a fresh session in the same worktree; `maxAttempts` abandons it and pauses the item.
5. **Lifecycle:** draft completion emits `review-drafted`; the persistent worktree stays for later heads. Idle sessions can be reused; busy sessions are never messaged or closed. A session is replaced after `sessionReviews` done reviews. prflow closes its idle reviewer sessions after `idleCloseHours`. On PR merge/close, a clean worktree with no busy session is archived and its local branch deleted; dirty or busy worktrees get one `needs-decision`.
6. **Publication:** prflow stores and shows drafts only. To publish, run `/pr review <pr_url>` as the draft's account and pass the draft's `## Packet` section from `prflow review show <draft-id>` as the matching packet. The `pr` skill selects the event, adds disclosure and the dedup marker, and checks packet freshness.

Commands (run on the user's request):

- `prflow review list [--format json]`: every draft, its PR and head, GitHub-derived posted state, revision, verdict suggestion, coverage (`complete`, `INCOMPLETE (<gaps>)`, or `coverage unknown` for legacy drafts), and comment count. Drafts with mismatched metadata or a changed `review.md` are invalid, not ready.
- `prflow review show <draft-id>`: the saved draft, account, PR URL, and GitHub-derived posted state. Its publish target is checked against configured account coverage, the recorded dispatch, head, and draft path.

The draft format, lifecycle, and events are in `references/review.md`.

## State and Rails

Migration: remove `rerunsPerVersion` from existing configs; prflow rejects unknown rails keys.

State lives in `${XDG_STATE_HOME:-~/.local/state}/prflow/` (`--state-dir` overrides). See `references/state.md` for the files, tables, event format, dispatch lifecycle, and rails.

- `prflow status [--format json]`: items from the last scan, open dispatches with leases, pauses, backoff, and the last tick.
- `prflow pause [--all] [--reason <text>]` pauses prflow: `tick` stops completely until `prflow resume`. `prflow pause --item <owner/repo#N>` pauses one item.
- `prflow resume` resumes prflow, `--item` one item, `--all` prflow and every paused item.
- `prflow recover <dispatchId>` gives one dispatch a fresh start: an open one is marked stale (its session is replaced next tick); a failed, stale, or abandoned one is reopened. Attempts and the item's loop breaker count restart at zero, and a pause the dispatch caused is lifted. Use it after fixing what made a dispatch fail or get abandoned.
- `prflow import-legacy` copies the legacy `pr-comment-watch` and `pr-watch` `dispatched.txt` entries into the ledger once. It only reads those files.
- Run these on the user's request. Never edit state files by hand.

## Classifier

One kind per PR, in priority order:

| Kind | Trigger | Next action | Owner |
| --- | --- | --- | --- |
| `mergeable` | GitHub reports APPROVED, checks green, and merge state CLEAN; this is not a PR readiness decision | Route to `/pr` for its lifecycle | you |
| `ci` | Failed or cancelled checks, nothing pending; cancelled job names appear in details | `/pr` lifecycle brief | agent |
| `comments` | Human comment, review body, changes request, or unresolved thread newer than the head commit, with no later reply from `me`. A bot's change request or unresolved inline thread counts too. A bot's issue comments and COMMENTED review summaries never count | `/pr` lifecycle brief | agent |
| `behind` | BEHIND or DIRTY, nothing pending | `/pr` lifecycle brief | agent |
| `review-requested` | `me` is requested, not draft, required checks finished, head not yet reviewed by `me`. Low priority when another human already approved and no one requested changes | Reviewer session, draft only; then you decide on the draft | agent reviewer, then you |
| `cleanup` | Orca worktree whose PR is merged or closed | Archive if clean, else you check | prflow or you |
| `waiting` | Anything else | None | others |

Author PRs list every trigger that fired in `triggers`. prflow encodes no repo-specific rules: every check counts the same.

An approval whose body asks for no changes (no "changes needed", "changes requested", "request changes", or "please fix") is informational: it never triggers `comments`, and the report row shows its body as a `note:`. Unresolved threads still trigger on their own.

Pending reviews with no timestamp are ignored, and a PR with no commits is skipped.

## Development

- `npm install` once at the repository root (an npm workspace), then `npm test` in the skill directory (strict `tsc --noEmit`, then `node --test`).
- Fixtures live in `tests/fixtures.ts`.

## Safety Rules

- Never call `gh auth switch`. Each account's `gh` calls use `GH_TOKEN` from `gh auth token -u <login>`. Only the active account may fall back to ambient auth.
- Never commit `config.json`. Only `config.example.json` is tracked.
- Never run a `gh` command outside the read-only allowlist in `assertReadOnly` (`scripts/adapters/gh.ts`).
- Never write PR content from prflow. All PR action and publication rules belong to the `pr` skill; reviewer sessions save drafts only.
- Never turn off review dry run (`prflow.review.dryRun`) without the user's request. First check that no enabled Orca automation launches reviewers for the same PRs (`orca-ide automations list`).
- Tick makes no GitHub writes.
- Review preparation git writes are limited to guarded `git -C <absolute path> fetch origin pull/<n>/head` and `git -C <absolute path> reset --hard <40-hex sha>`, only on a clean `prflow-review/` branch with no busy session. Local branch deletion is limited to the separate guarded `git --git-dir ... update-ref -d` cleanup action described below. The reviewer brief separately allows one status write using `orca-ide worktree set --worktree active ... --unread` after saving a draft; no other reviewer Orca writes are allowed. All prflow-issued Orca calls must pass `assertOrca` (`scripts/adapters/orca.ts`): `worktree list`, `agent list`, and `terminal list` reads; `worktree rm --worktree path:<path> --json` (no `--force`, no `--delete-branch`); `agent launch --agent pi --surface terminal --worktree id:<id> --prompt <brief> --json`; `worktree create --repo id:<repoId> --name prflow-review-<slug> --branch prflow-review/<slug> --pr <n> --no-parent --setup run --json` (review worktrees only, `assertReviewWorktree`); `worktree set --worktree path:<review path> --workspace-status <id> --comment <text> [--unread|--read] --json` (`assertWorktreeSet`); `worktree set --worktree path:<review path> --display-name <PR head branch> --json` (`assertWorktreeName`); `worktree set --worktree path:<review path> --pr <n> --json` (`assertWorktreeLinkPr`); `worktree set --worktree id:<non-review worktree id> --workspace-status <id> --comment <text> --unread --json` to move a Blocked card out (`assertTaskStatusSet`); `worktree set --worktree id:<non-review worktree id> --workspace-status <id> --json` to sync a worktree's column (`assertWorktreeStatusSet`). For both, a review worktree is one on a `prflow-review/` branch or in a folder named exactly `prflow-review-<repo>-<n>` (`isReviewWorktree`), the same test the tick steps use to skip it; a refused or failed move is reported as `action-failed` and does not fail the tick; `worktree set --worktree path:<review path> --no-parent --json` (`assertWorktreeUnparent`); `orchestration send --to <term_ handle or orca_session_id:> --subject --body --json`; `terminal close --terminal <term_ handle> --json`; `terminal send --terminal <term_ handle> --text <Escape> --json` (Escape only: no text, no Enter); and `terminal wait --terminal <term_ handle> --for tui-idle --timeout-ms 30000 --json`. Never archive an ordinary worktree with uncommitted files or unpushed commits. Review worktrees require a clean tree and verified session ownership; reviewers do not commit.
- Never use `orca-ide terminal send` for anything but the Escape that stops a busy Pi turn: briefs and nudges go by `orchestration send`. Never create a worktree other than a review worktree, never archive one before its PR closes or merges, and never edit or disable Orca automations.
- Never message, nudge, or launch into a worktree whose Pi session is busy. Interrupt a busy session only after `busyWaitMinutes`, only when it is the lone busy Pi terminal, and message it only after its prompt is back. Never close a busy session. Close only idle sessions prflow launched, including aged-out reviewer sessions.
- Never turn off dispatch dry run (`prflow.dispatch.dryRun`) without the user's request. First check that no enabled Orca automation sends the same briefs (`orca-ide automations list`).
- Never run a git write other than guarded review fetch/reset or `git --git-dir <abs> update-ref -d refs/heads/<branch> <sha>` (`assertReviewFetch`, `assertReviewReset`, `assertDeleteBranch`, `scripts/adapters/git.ts`). Delete only a merged PR branch or a `prflow-review/` branch after its worktree is archived. Never delete a remote branch.
- Never turn off dry run (`prflow.actions.dryRun`) without the user's request.
- Never move a card out of Blocked or Paused, a review worktree, or the main checkout with the worktree status sync, and never turn off its dry run (`prflow.worktreeStatus.dryRun`) without the user's request.
- Never move a card that is not in the Blocked column, has no record, or has only `manual`, and never move a Paused card or a review worktree out of Blocked. Never edit `blocked.json` except to remove the record of a card prflow just moved.
- Never edit files in the prflow state directory by hand; use `pause`, `resume`, `recover`, and `import-legacy`.
- Never write to the legacy `pr-comment-watch` or `pr-watch` state directories.
- Run Orca as `orca-ide`, never bare `orca` (on some Linux desktops that is the GNOME screen reader).

## Output Style

Relay the report groups in order: Needs your decision, Ready to act, In flight, Blocked on others, Cleanup. Relay a tick's `## New events` lines before the report. One row per item: `repo#PR`, title, kind and status, `changed:` (what changed since the last printed report, such as `new head d5f5da28, retitled`), next action, owner, the account when more than one is configured, and any `note:` (an informational approval's body). A tick reprints the report when an item's kind, version, or triggers change, but not for a new head alone while that PR's checks are still running. One In flight row per open dispatch: item, kind, dispatch id, session handle, state, age, lease, and attempt. Print "Nothing to report." when empty.
