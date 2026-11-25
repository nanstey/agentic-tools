# prflow review drafts

How `prflow tick` turns a `review-requested` PR into a saved draft review and shows whether GitHub has a matching submitted review. Code: `scripts/review.ts` (flow), `scripts/review-cmd.ts` (read-only list/show), `scripts/core/draft.ts` (format and parsing), `templates/briefs/review.md` and `review-nudge.md` (briefs).

## Switch

| Config | Default | Effect |
| --- | --- | --- |
| `prflow.review.dryRun` | `true` | No reviewer dispatch or Orca status or display-name write; each target is announced once per head |
| `prflow.review.maxConcurrent` | `2` | Reviewer dispatches open at once |
| `prflow.review.sessionReviews` | `5` | Completed reviews per Pi session before replacing it |
| `prflow.review.idleCloseHours` | `24` | Idle time before closing a prflow-launched reviewer session |
| `prflow.review.statuses` | `review-draft`, `reviewing`, `review-changes`, `review-approved` | Orca workspace status ids |
| `tick --dry-run` | off | Forces dry run for actions, Pi dispatch, and reviews |

`prflow.review.dryRun` is separate from `prflow.dispatch.dryRun` and `prflow.actions.dryRun`. Keep it
on while the "Bryce PR review watch" Orca automation still launches reviewers.

## Full review

The review brief (`templates/briefs/review.md`, v5) makes every reviewer a full
`review-code` coordinator: it dispatches each row the chosen depth requires,
the candidate verifier, and the advisory validator as separate foreground
`Agent` children, never `skip` depth, and at least `standard` unless a later
head's delta over a complete earlier draft is trivial. The reviewer must not do
a row's work itself. If a row or the verifier still cannot run after one
corrected retry, the reviewer records the failure: `Coverage: incomplete
(...)`, Verdict `comment`, and a reply that starts `REVIEW INCOMPLETE:`.

Before v5 the brief only said to run `/pr review <url> report`, and reviewers
with the `Agent` tool chose a cheaper inline self-review, which left every
packet `incomplete` and every publication a `COMMENT`.

## Posting

prflow only stores and shows drafts. The reviewer runs `/pr review <pr_url> report` to produce the packet; publication happens by running `/pr review <pr_url>` as the draft's account and passing the draft's `## Packet` section as the matching packet. The `pr` skill owns freshness checks, event selection, disclosure, deduplication, and the GitHub write. See the `pr` skill's `references/06-review.md`.

Draft status is read from the PR's existing review snapshot: a draft is posted when its account has a submitted, non-pending review at the reviewed commit, or at a later current PR head in a review submitted since the draft was created. `review list` and `review show` perform read-only GitHub reads to report this status. If one PR cannot be read, `review list` reports `posted: unknown (<short error>)` for that row and continues. `review show` reports a read error rather than guessing.

The reviewer may make no GitHub writes. Its only Orca write is the one-time worktree status/unread update after saving a draft. Every `gh` call uses the read-only allowlist (`assertReadOnly`, `scripts/adapters/gh.ts`).

## Revisions

A reviewer may rewrite a saved draft. Code: `scripts/revisions.ts`.

| Rule | Behaviour |
| --- | --- |
| Revision | Legacy `posted.json` and ledger history may show revision numbers; current publication uses `/pr review` and does not create prflow revision history |
| Event | Tick emits `review-drafted` when a finished dispatch saves a draft |
| Status | GitHub's current submitted review takes precedence; otherwise the saved draft status and verdict are shown |


## Lifecycle

```
(item review-requested, head8 not yet dispatched)
  another reviewer of this PR open  -> wait (one reviewer per PR)
  maxConcurrent reviewers open      -> wait
  no Orca clone of the repo         -> needs-decision once
  no review worktree yet            -> create persistent worktree, reset cleanly,
                                       reuse idle Pi or launch one (review-started)
  existing worktree                 -> busy waits; idle Pi gets orchestration send
launched|working:
  new activity                      -> working, lease renewed (no busy limit)
  parseable draft saved, idle/gone  -> done (session-finished)
  review no longer requested        -> done
  idle, no usable draft             -> nudged once (review-nudge)
  idle again, or session closed     -> stale -> retry, attempts + 1
  lease expired                     -> stale
attempts = maxAttempts              -> abandoned, item paused
done:
  draft saved                       -> review-drafted once; worktree kept
  after idleCloseHours              -> close prflow-launched idle reviewer
closed or merged PR:
  clean and no open/busy session     -> close only idle prflow-launched terminals,
                                       archive, delete local prflow-review/ branch
  unowned Pi session, dirty or busy  -> needs-decision once
```

The dispatch version is the head sha8, so new comments on the same head do not
start another review, and a new head does. Legacy `pr-watch/dispatched.txt`
entries for a head (`prflow import-legacy`) count as done.

## Worktree and status

| Field | Value |
| --- | --- |
| Folder (`--name`) | `prflow-review-<repo>-<n>` |
| Display name | The PR's head branch (`headRefName`, e.g. `c/t219-converted-giftcert-followup`) |
| Branch | `prflow-review/<repo>-<n>` (local only, never pushed) |
| Base | Before each review, prflow fetches `pull/<n>/head`, resets to the exact PR SHA, and verifies HEAD |
| Link | `--pr <n>`, `--no-parent`, `--setup run`, then `worktree set --pr <n>` so Orca's `linkedPR` shows the PR card |
| Lineage | Top-level in the repo, never under the caller (see below) |
| Status at start | `prflow.review.statuses.reviewing`, `reviewing <head8>`, as soon as the reviewer is launched or messaged |

Orca files a new worktree under the calling bot's folder when the create call
carries the caller's terminal handle or agent session id, even with
`--no-parent` (the host reads `ORCA_TERMINAL_HANDLE` and `ORCA_AGENT_SESSION_ID`
from the CLI and re-parents creates from a bot chat). So prflow runs `worktree
create` without the caller's Orca identity (`detachedEnv`, `scripts/adapters/orca.ts`:
`ORCA_TERMINAL_HANDLE`, `ORCA_AGENT_SESSION_ID`, `ORCA_AGENT_SESSION_SPAWN_TOKEN`,
`ORCA_BOT_TOOLS_TOKEN`, `ORCA_WORKSPACE_ID`, `ORCA_WORKTREE_ID`); the connection
variables stay. If the create reply still reports a parent (`lineage`,
`workspaceLineage`, or `crossStoreLineage`), prflow drops it with `orca-ide
worktree set --worktree path:<review path> --no-parent --json`
(`assertWorktreeUnparent`: a `prflow-review-` folder only). A failure is
reported once and does not stop the review. prflow creates no other worktrees;
Pi dispatch uses existing worktrees.

`worktree create --pr <n>` records the PR only in Orca's `linkedItems`; Orca
shows the PR card from `linkedPR`. So right after the create, prflow links the
worktree with `orca-ide worktree set --worktree path:<review path> --pr <n>
--json` (`assertWorktreeLinkPr`: a `prflow-review-` folder and a positive PR
number only). Status sync does the same for any open PR's review worktree whose
`linkedPR` is empty, which repairs worktrees created before this step. A failed
link is reported once, does not stop the review, and is retried next tick.
Review dry run announces `would link <path> to PR #<n>` instead.

Status sync runs before new reviewers start, so prflow sets a review worktree
it just launched or messaged a reviewer in to `reviewing <head8>` itself,
rather than leaving it in Orca's default column until the next tick. Review dry
run includes this write in the announced plan.

The repo id is the `repoId` of the repo's main worktree in `orca-ide worktree
list`; with several clones, the one whose folder is named after the repo. A
lost create reply is recovered by finding the persistent worktree by its branch. Orca's numeric branch suffix is tolerated.

The display name shows the author's branch in Orca; it is the only part that
follows the PR. The folder prefix `prflow-review-` gates the review `git fetch`
and `reset --hard` and every review worktree write, and the local
`prflow-review/` branch is how status sync, reap, and recovery find review
worktrees, so neither changes. Right after `worktree create`, prflow sets the
display name with `orca-ide worktree set --worktree path:<review path>
--display-name <headRefName> --json` (`assertWorktreeName`: a `prflow-review-`
folder, a name with no control characters or leading `-`, nothing else). A
failed rename does not stop the review; status sync retries it.

After saving a draft, the reviewer makes one Orca write: `orca-ide worktree set --worktree active --workspace-status <id> --comment "draft: <verdict>, <n> inline, not posted" --unread --json`. It uses `prflow.review.statuses.changes` for request-changes, `prflow.review.statuses.approved` for approve, and `prflow.review.statuses.reviewing` for comment. This is the only Orca write the reviewer may make. Tick also synchronizes status and unread state.

Status sync runs for open PR review worktrees, including those that drop out of search, and writes only when status, comment, or unread state differs. It fetches a missing PR snapshot read-only. Priority: draft PR; current head with neither posted review nor saved draft (reviewing/checks/queued); an unposted draft revision saved after the latest posted review on this head; latest posted review on this head; saved draft verdict. A draft sets unread once per head, and a newly seen post sets read once. Manual status changes are overwritten on the next tick. Failed writes are retried while fields still differ; the `action-failed` event is deduplicated.

Status sync also sets the display name to the PR's current `headRefName`
when it differs (a new review worktree, a renamed head branch, or a manual
rename), as a separate `--display-name` write. Review dry run announces `would
set <path> display name <branch>` once per worktree and name instead.

| Current-head outcome | Status | Comment |
| --- | --- | --- |
| PR draft | configured `draft` | `PR in draft` |
| No posted review or saved draft | `reviewing` | `reviewing`, `checks running on`, or `queued` plus head8 |
| Submitted `APPROVED` | `approved` | `approved at <head8>` |
| Submitted `CHANGES_REQUESTED` | `changes` | `changes requested at <head8>` |
| Submitted `COMMENTED` | `reviewing` | `commented at <head8>` |
| Saved draft | based on verdict | `draft: <verdict>, <n> inline, not posted` |
| Saved incomplete draft | `reviewing` | `draft: comment, incomplete, <n> inline, not posted` |
| Legacy draft revision metadata | based on verdict | Legacy status text may include a revision number |

## Draft

Path: `${state}/drafts/<owner>-<repo>-<n>/<head8>/review.md`. Draft id:
`<owner>-<repo>-<n>-<head8>`. prflow writes `meta.json` (item, URL, full head
sha, account, dispatch id) beside it before the reviewer starts. The reviewer session can write in that folder, so `review list` and `review show` do not trust `meta.json` alone: they check its item, URL, and head against the draft folder and the review dispatch, and its account against the shared config. A mismatch marks the draft invalid, and `show` prints `invalid` for the PR, head, and account. Without a readable config, the account is not checked and a warning says so. Legacy `posted.json` revision history may remain beside a draft.

```
<!-- prflow review draft v2 -->
# Review of owner/repo#N at <head8>

Verdict: comment
Coverage: complete

## Summary

Posted as the review body.

## Inline comments

### path/to/file.ext:42

Posted on that line (RIGHT side).

### path/to/file.ext:10-14

Posted on that range.

## Notes for Noel

Never posted.

## Packet

The verbatim complete output of `/pr review <pr_url> report`; publication passes this section as the matching packet.
```

Exactly one verdict word is required: `comment`, `approve`, or `request-changes`.
The `Coverage:` line is required in v2 drafts: `complete` when every required
`review-code` row and the candidate verifier ran as child agents, else
`incomplete (<what did not run, and why>)`. An incomplete draft may only
suggest `comment`, and a `complete` line contradicted by the packet's own
first `Verdict:` line (`incomplete`) makes the draft invalid. Legacy v1 drafts
still parse; their coverage is `incomplete` when the packet verdict says so,
else `unknown`. `review list`, `review show`, the `review-drafted` event, the
report's next action, and the worktree status comment all show an incomplete
review as incomplete, so it is never mistaken for a full one. `None.` under Inline comments means none. Inline paths are relative to the repository root and can target a line or range, for example `### path/to/other.ext:10-14`. Publication formatting and disclosure belong to the `pr` skill.

## Events

| Event | When |
| --- | --- |
| `dispatched` | A reviewer is planned (before the worktree is created) |
| `review-started` | The reviewer launched: session, worktree, draft path |
| `review-drafted` | The draft is saved: id, verdict suggestion, coverage (`complete`, `INCOMPLETE (<gaps>)`, or `coverage unknown`), inline comment count, and path |
| `archived` | The PR is closed or merged and the review worktree is safe to archive |
| `dry-run`, `needs-decision`, `nudged`, `session-finished`, `session-stale`, `action-failed`, `abandoned`, `paused`, `rail-tripped` | As for Pi dispatch (`references/dispatch.md`) |
