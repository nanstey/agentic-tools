# prflow review drafts

How `prflow tick` turns a `review-requested` PR into a saved draft review, and
how a draft reaches GitHub. Code: `scripts/review.ts` (flow),
`scripts/review-cmd.ts` (`prflow review`), `scripts/core/draft.ts` (format and
payload), `templates/briefs/review.md` and `review-nudge.md` (briefs).

## Switch

| Config | Default | Effect |
| --- | --- | --- |
| `review.dryRun` | `true` | No reviewer dispatch or Orca status write; each target is announced once per head |
| `review.maxConcurrent` | `2` | Reviewer dispatches open at once |
| `review.sessionReviews` | `5` | Completed reviews per Pi session before replacing it |
| `review.idleCloseHours` | `24` | Idle time before closing a prflow-launched reviewer session |
| `review.statuses` | `review-draft`, `reviewing`, `review-changes`, `review-approved` | Orca workspace status ids |
| `tick --dry-run` | off | Forces dry run for actions, Pi dispatch, and reviews |

`review.dryRun` is separate from `dispatch.dryRun` and `actions.dryRun`. Keep it
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
| Refuses: a draft that does not parse or was already posted, a PR that is not open, a commit the account already reviewed, `approve` after the head moved | `postDraft` |
| A crash after GitHub accepted the review but before prflow recorded it: the next `post` re-reads the PR and refuses, because the account already reviewed that commit | `postDraft` |

The orchestration layer runs `post` only on the user's explicit instruction.
The default event is `comment`; the draft's verdict is only a suggestion.

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
| Name | `prflow-review-<repo>-<n>` |
| Branch | `prflow-review/<repo>-<n>` (local only, never pushed) |
| Base | Before each review, prflow fetches `pull/<n>/head`, resets to the exact PR SHA, and verifies HEAD |
| Link | `--pr <n>`, `--no-parent`, `--setup run` |

The repo id is the `repoId` of the repo's main worktree in `orca-ide worktree
list`; with several clones, the one whose folder is named after the repo. A
lost create reply is recovered by finding the persistent worktree by its branch. Orca's numeric branch suffix is tolerated.

After saving a draft, the reviewer makes one Orca write: `orca-ide worktree set --worktree active --workspace-status <id> --comment "draft: <verdict>, <n> inline, not posted" --unread --json`. It uses `review.statuses.changes` for request-changes, `review.statuses.approved` for approve, and `review.statuses.reviewing` for comment. This is the only Orca write the reviewer may make. Tick also synchronizes status and unread state.

Status sync runs for open PR review worktrees, including those that drop out of search, and writes only when status, comment, or unread state differs. It fetches a missing PR snapshot read-only. Priority: draft PR; current head with neither posted review nor saved draft (reviewing/checks/queued); latest posted review on this head; saved draft verdict. A draft sets unread once per head, and a newly seen post sets read once. Manual status changes are overwritten on the next tick. Failed writes are retried while fields still differ; the `action-failed` event is deduplicated.

| Current-head outcome | Status | Comment |
| --- | --- | --- |
| PR draft | configured `draft` | `PR in draft` |
| No posted review or saved draft | `reviewing` | `reviewing`, `checks running on`, or `queued` plus head8 |
| Submitted `APPROVED` | `approved` | `approved at <head8>` |
| Submitted `CHANGES_REQUESTED` | `changes` | `changes requested at <head8>` |
| Submitted `COMMENTED` | `reviewing` | `commented at <head8>` |
| Saved draft | based on verdict | `draft: <verdict>, <n> inline, not posted` |

## Draft

Path: `${state}/drafts/<owner>-<repo>-<n>/<head8>/review.md`. Draft id:
`<owner>-<repo>-<n>-<head8>`. prflow writes `meta.json` (item, URL, full head
sha, account, dispatch id) beside it before the reviewer starts, and
`post.json` (the exact payload) when posting.

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
| `review-drafted` | The draft is saved: id, verdict suggestion, inline comment count, path |
| `archived` | The PR is closed or merged and the review worktree is safe to archive |
| `review-posted` | `prflow review post` published the draft: event, comment count, review URL |
| `dry-run`, `needs-decision`, `nudged`, `session-finished`, `session-stale`, `action-failed`, `abandoned`, `paused`, `rail-tripped` | As for Pi dispatch (`references/dispatch.md`) |
