# prflow review drafts

How `prflow tick` turns a `review-requested` PR into a saved draft review, and
how a draft reaches GitHub. Code: `scripts/review.ts` (flow),
`scripts/review-cmd.ts` (`prflow review`), `scripts/core/draft.ts` (format and
payload), `templates/briefs/review.md` and `review-nudge.md` (briefs).

## Switch

| Config | Default | Effect |
| --- | --- | --- |
| `review.dryRun` | `true` | No worktree is created and no reviewer launched, nudged, closed, or archived. Each reviewer is announced once per head as a `dry-run` event with its exact target and brief |
| `review.maxConcurrent` | `2` | Reviewer dispatches open at once. More wait; a live tick emits `rail-tripped` once |
| `tick --dry-run` | off | Forces dry run for actions, Pi dispatch, and reviews |

`review.dryRun` is separate from `dispatch.dryRun` and `actions.dryRun`. Keep it
on while the "Bryce PR review watch" Orca automation still launches reviewers.

## Posting gate

Tick never posts. The reviewer brief forbids every GitHub write, and the
reviewer runs the `pr` skill's review in `report` mode, which never publishes.
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
  no review worktree yet            -> planned, meta.json, create worktree,
                                       launch Pi with the review brief
                                       (review-started)
  review worktree exists (retry)    -> close the old idle session, launch fresh
launched|working:
  new activity                      -> working, lease renewed (no busy limit)
  parseable draft saved, idle/gone  -> done (session-finished)
  review no longer requested        -> done
  idle, no usable draft             -> nudged once (review-nudge)
  idle again, or session closed     -> stale -> retry, attempts + 1
  lease expired                     -> stale
attempts = maxAttempts              -> abandoned, item paused
done:
  draft saved                       -> review-drafted once
  draft missing or unparseable      -> needs-decision once; worktree kept
  any Pi session there busy         -> wait
  dirty or unpushed                 -> needs-decision once; worktree kept
  otherwise                         -> close the reviewer, archive the
                                       worktree (archived), delete its
                                       prflow-review/ branch
```

The dispatch version is the head sha8, so new comments on the same head do not
start another review, and a new head does. Legacy `pr-watch/dispatched.txt`
entries for a head (`prflow import-legacy`) count as done.

## Worktree

| Field | Value |
| --- | --- |
| Name | `prflow-review-<repo>-<n>-<head8>` |
| Branch | `prflow-review/<repo>-<n>-<head8>` (local only, never pushed) |
| Base | The repo default; the reviewer fetches `pull/<n>/head` and resets to the head sha |
| Link | `--pr <n>`, `--no-parent`, `--setup skip` |

The repo id is the `repoId` of the repo's main worktree in `orca-ide worktree
list`; with several clones, the one whose folder is named after the repo. A
lost create reply is recovered by finding the worktree by its branch.

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

`None.` under Inline comments means none.

## Events

| Event | When |
| --- | --- |
| `dispatched` | A reviewer is planned (before the worktree is created) |
| `review-started` | The reviewer launched: session, worktree, draft path |
| `review-drafted` | The draft is saved: id, verdict suggestion, inline comment count, path |
| `archived` | The review worktree is archived after its draft was saved |
| `review-posted` | `prflow review post` published the draft: event, comment count, review URL |
| `dry-run`, `needs-decision`, `nudged`, `session-finished`, `session-stale`, `action-failed`, `abandoned`, `paused`, `rail-tripped` | As for Pi dispatch (`references/dispatch.md`) |
