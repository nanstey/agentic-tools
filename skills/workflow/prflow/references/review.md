# prflow review drafts

How `prflow tick` turns a `review-requested` PR into a saved draft review, and
how a draft reaches GitHub. Code: `scripts/review.ts` (flow),
`scripts/review-cmd.ts` (`prflow review`), `scripts/core/draft.ts` (format and
payload), `templates/briefs/review.md` and `review-nudge.md` (briefs).

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

## Posting gate

Tick never posts. The reviewer brief forbids every GitHub write. Its only Orca write is the one-time worktree status/unread update after saving a draft. The reviewer runs the `pr` skill's review in `report` mode, which never publishes.
The only review write is:

```
prflow review post <draft-id> [--event comment|approve|request-changes] --yes
```

| Guard | Where |
| --- | --- |
| `TickDeps` has no review write; tick modules never import the post path | `scripts/tick.ts`, `tests/review.test.ts` |
| Tick's `gh` calls pass the read-only allowlist, which rejects `gh api --method POST` | `assertReadOnly`, `scripts/adapters/gh.ts` |
| The post call is exactly `gh api --method POST repos/<o>/<r>/pulls/<n>/reviews --input <state>/drafts/.../post.json`, with the input under the active state directory | `assertReviewPost`, `scripts/adapters/gh.ts`; `realPostDeps`, `scripts/deps.ts` |
| `--yes` is required; without it the command prints what it would post and exits 1 | `postDraft`, `scripts/review-cmd.ts` |
| The review is posted as the draft's account (`GH_TOKEN` from `gh auth token -u <login>`), pinned to the reviewed commit (`commit_id`) | `realPostDeps`, `scripts/deps.ts` |
| Refuses: a draft that does not parse, a revision already posted, a PR that is not open, a commit the account already reviewed (unless this is a later revision of a posted draft, saved after that review) | `postDraft` |
| Never approves unreviewed commits: `approve` on a head that moved since the reviewed commit posts as `COMMENT`, the body ending with `approval withheld: new commits since <sha8>; the next review cycle covers them` (`<sha8>` is the reviewed commit); the output and the `review-posted` event say `approve downgraded to COMMENT: approval withheld, head moved to <new8>`. `comment` and `request-changes` post as-is, pinned to the reviewed commit. The next review cycle reviews the new head | `postDraft`, `withholdApproval` |
| A crash after GitHub accepted the review but before prflow recorded it: the next `post` re-reads the PR and refuses, because the account reviewed that commit after the revision was saved | `postDraft` |

The orchestration layer runs `post` only on the user's explicit instruction.
The default event is `comment`; the draft's verdict is only a suggestion.

## Revisions

A reviewer may rewrite its draft after it was posted, for example when told to
approve after a comment review. Code: `scripts/revisions.ts`.

| Rule | Behaviour |
| --- | --- |
| Revision | Each posted text is a revision, recorded in `posted.json` beside the draft: number, sha256 of the text, event, time, and inline comments. A saved text that matches no posted revision is the next, unposted revision (`r2`, `r3`, ...) |
| Older posts | A draft posted before revisions were tracked has only the `review-posted:<id>` ledger row. It counts as `r1`: the draft is `r1` while its file is not newer than that row, and `r1`'s inline comments come from the `post.json` sent then. The first later post writes `posted.json` |
| Event | Tick emits `review-drafted` with `revision r<n> (r<n-1> posted)` once per unposted revision of a finished dispatch |
| Status | A revision that is not posted and was saved after the latest posted review on this head wins status sync: status from its verdict, comment `draft r<n>: <verdict>, not posted`, unread once per revision. Once it is posted, the posted review wins again |
| Post | `prflow review post` posts a later revision on a head the account already reviewed when the revision was saved after that review. The review body is the summary plus only the inline comments that no earlier posted revision had (same path, lines, and text). Re-posting the same revision and posting when a newer review exists are refused; `approve` after the head moved posts as `COMMENT` with the approval-withheld note. Ledger ref: `review-posted:<id>` for `r1`, `review-posted:<id>:r<n>` after |

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
| Link | `--pr <n>`, `--no-parent`, `--setup run` |
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
| Draft revision `r<n>` saved after the latest posted review, not posted | based on verdict | `draft r<n>: <verdict>, not posted` |

## Draft

Path: `${state}/drafts/<owner>-<repo>-<n>/<head8>/review.md`. Draft id:
`<owner>-<repo>-<n>-<head8>`. prflow writes `meta.json` (item, URL, full head
sha, account, dispatch id) beside it before the reviewer starts,
`post.json` (the exact payload) when posting, and `posted.json` (posted
revisions) after each successful post.

```
<!-- prflow review draft v1 -->
# Review of owner/repo#N at <head8>

Verdict: approve | request-changes | comment

## Summary

Posted as the review body.

## Inline comments

### path/to/file.ext:42

Posted on that line (RIGHT side).

### path/to/file.ext:10-14

Posted on that range.

## Notes for Noel

Never posted.
```

`None.` under Inline comments means none. Inline comments can target a line or range, for example `### path/to/other.ext:10-14`.

## Events

| Event | When |
| --- | --- |
| `dispatched` | A reviewer is planned (before the worktree is created) |
| `review-started` | The reviewer launched: session, worktree, draft path |
| `review-drafted` | The draft is saved: id, verdict suggestion, inline comment count, path; again with `revision r<n>` when a posted draft is rewritten |
| `archived` | The PR is closed or merged and the review worktree is safe to archive |
| `review-posted` | `prflow review post` published the draft (and revision, after `r1`): event, comment count, review URL |
| `dry-run`, `needs-decision`, `nudged`, `session-finished`, `session-stale`, `action-failed`, `abandoned`, `paused`, `rail-tripped` | As for Pi dispatch (`references/dispatch.md`) |
