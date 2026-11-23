# Plan: deduplicate the `pr` and `prflow` skills

Status: decisions recorded (section 4), restructured around a strict pr/prflow boundary; re-analyzed after rebase onto `09a5867` (#198, O11); implemented (C1-C10) and source-reviewed clean after three review rounds; see section 8. Branch: `prflow-pr-dedup`.
Paths are relative to the repository root.

## Outcome

Agents that work on PRs get one set of rules, from `pr`. prflow sessions, orca-orchestrator, and
orca-task-status stop giving contradicting instructions (threads, drafts, rebases, reruns, review
posting, cleanup), and an Orca card no longer flips between columns depending on who wrote it last.

## Acceptance

Regression for all items: `npm test` passes in `skills/workflow/prflow`, `skills/workflow/repo-sync`,
`skills/agent/orca-task-status`, and `skills/agent/orca-orchestrator` (each also runs `lib/tests`);
`bash install/tests/skill-links.test.sh` and `python3 .plans/unified-review/tests/test_unified_review_contract.py`
pass.

- **A1** (code) WHEN prflow renders a `ci`, `comments`, or `behind` brief THEN it contains the trigger
  details and `/pr <pr_url>` and none of: `force-with-lease`, `git rebase`, `Never resolve`,
  `request or nudge reviewers`, `Stop after pushing`, `rerun`. Check: `tests/brief.test.ts`.
- **A2** (code) WHEN prflow renders a reviewer brief THEN it runs `/pr review <pr_url> report` and has no
  `merge-base` diff and no Summary/Inline content rules of its own. Check: `tests/brief.test.ts`.
- **A3** (code) WHEN a PR with an open prflow dispatch becomes a draft THEN the dispatch is not marked
  done and the item stays in progress; a draft with no prflow dispatch still has no triggers. Check: a
  new test in `tests/agents.test.ts` or `tests/classify.test.ts` that fails before the change.
- **A4** (code) WHEN a PR's only non-passing checks are cancelled (none failed or pending) THEN prflow
  emits a `ci` trigger naming the cancelled jobs and runs no `gh` write; `grep -rn "assertRerun\|run rerun\|rerunsPerVersion" skills/workflow/prflow/scripts config.example.json` prints nothing.
- **A5** (code) WHEN `prflow review post <id> --yes` is run THEN it exits non-zero as an unknown
  command and posts nothing; `grep -rn assertReviewPost skills/workflow/prflow/scripts` prints nothing;
  `review list` and `review show` still pass their tests, and a draft whose account already reviewed
  its head is listed as posted.
- **A6** (code) WHEN prflow classifies an approved, green, `CLEAN` PR THEN its kind is `mergeable`;
  `grep -rn merge-ready skills/workflow/prflow skills/agent/orca-orchestrator` prints nothing.
- **A7** (code) WHEN `prDecision` and `openPrColumn` get the same PR (each row of the O11 table) THEN
  they return the same column (ignoring local dirty/HEAD checks and drafts). Check: a shared table test
  in `lib/tests`.
- **A8** (judge) WHEN `pr`'s `ci.md`, `merge.md`, and `monitor.md` meet a cancelled check THEN they rerun
  it once per head before counting it as failed. Check: read those three files.
- **A9** (code) WHEN orca-task-status `cleanup` runs on a merged PR whose local `HEAD` equals the merged
  head and the tree has untracked files THEN it calls `worktree rm --worktree id:<id> --force --json`;
  WHEN `HEAD` differs THEN it refuses. Check: `skills/agent/orca-task-status/tests`.
- **A10** (code) `grep -n "gh pr review\|resolveReviewThread\|never resolve" skills/agent/orca-orchestrator/SKILL.md`
  prints nothing, and the orchestrator posts drafts with `/pr review <url>` and the saved packet.
- **A11** (code) The `pr` and `prflow` frontmatter descriptions match section 3 and their `README.md` rows.
- **A12** (judge) `pr` contains no mention of prflow (`grep -rn prflow skills/dev/pr` prints nothing).

## Summary

The two skills overlap less in code than in rules. `pr` is prose only (`skills/dev/pr/`, no scripts).
`prflow` is a TypeScript CLI (`skills/workflow/prflow/`) whose Pi briefs restate, in a shorter and
sometimes contradicting form, the steps that `pr` owns: fixing CI, answering review comments,
rebasing, and drafting a review. Three other places (orca-orchestrator, orca-task-status, and
`lib/task-status.ts`) add their own versions of merge readiness, thread policy, and worktree cleanup.

Direction (decided): a strict boundary, not policy adoption. `pr` is the only place that says how
to act on a PR. prflow never restates, re-implements, or narrows a `pr` rule, in briefs or in code;
it detects, records, and hands off. Where prflow today encodes PR policy, the plan deletes it
rather than aligning it. Consistency comes before brief size; a later pass reworks the PR
information hierarchy for gradual disclosure (section 7).

Top findings:

1. **Conflicting thread policy.** `pr comments` resolves threads and re-requests reviewers. prflow's
   `comments` brief and orca-orchestrator forbid both. A session briefed by prflow that loads `pr`
   gets two opposite rules.
2. **Draft-before-changes hides PRs from prflow.** `pr`'s gates convert an open PR to draft before any
   fix push. prflow's classifier returns no triggers for drafts, so a session that follows `pr` makes
   its own PR invisible to prflow until something marks it ready again.
3. **Duplicated rebase procedure.** prflow's `behind` brief re-implements the rebase, including its own
   stacked-parent handling, while `pr rebase`/`restack`/`stack` own it and also stop for GitHub native
   stacks, which the brief does not check.
4. **Two review publication engines.** `/pr review` (other author, no mode) publishes with a v2
   dedup marker and its own event rules. `prflow review post` publishes drafts with different dedup
   and event rules and no marker. orca-orchestrator adds a third, hand-written `gh pr review` path.
5. **Four definitions of "ready to merge" and of a cancelled check.** prflow's classifier,
   prflow's worktree column sync (#198), `lib/task-status.ts` `prDecision`, and `pr merge`/`monitor`
   disagree. Two of them write the same Orca card, so a card can flip between columns (O11).
6. **Three post-merge worktree cleanups with conflicting flags.** `pr merge` removes the worktree with
   `--force`; orca-task-status `cleanup` forbids `--force`; prflow archives leftovers.
7. **Trigger overlap in descriptions.** prflow's description names "a CI or comment fix, a rebase, a
   review"; `pr`'s names "remediation". "Fix the CI on my PR" can route to either.

## 1. What each skill owns today

### `pr` (`skills/dev/pr/`)

- **Purpose** (`SKILL.md:3`, `:11`): drive one PR toward merge from one command; bias to action,
  non-interactive (`SKILL.md:49-59`).
- **Commands** (`SKILL.md:17-30`): `info`, `create`, `push`, `description`, `screenshots`, `rebase`,
  `restack`, `stack`, `split`, `ci`, `review [fix|comment|report]`, `comments`, `verification`,
  `ready`, `monitor`, `merge`, `automerge`; bare `/pr` runs the lifecycle (`references/lifecycle.md`).
- **Scripts / state**: none. State is per invocation (round state, review packets) under
  `references/gates.md:89-102`.
- **GitHub operations**: read PR, checks, logs, branch protection (`ci.md:28-36`); fix CI and push
  (`ci.md:16-24`, `push.md`); reply to and resolve threads, re-request reviewers
  (`comments.md:24-32`); rebase with `--force-with-lease` (`rebase.md`); convert to draft before changes
  (`gates.md:77`) and back to ready (`ready.md`); publish reviews on other authors' PRs with a v2 marker
  (`review.md:175-292`); squash-merge (`merge.md:37`).
- **Orca operations**: after a confirmed merge, `worktree rm --worktree id:<id> --force`
  (`merge.md:52-60`), or sync the primary checkout and send `/new` (`merge.md:43-50`).
- **Callers**: `idea-to-pr` (`SKILL.md:98`: `/pr create`, `/pr push`, `/pr`), `handoff` (indirectly,
  through `idea-to-pr`), `review-code` (`SKILL.md:23`, `references/caller-contract.md:7-18`),
  prflow's review brief (`templates/briefs/review.md:18`), `git` (`references/changes.md:9`,
  `conflicts.md:21`), `scope`, `refactor`, `issue-create`, `visual-capture`,
  `harness/pi/prompts/improve.md:47`, and `harness/{pi,omp}/APPEND_SYSTEM.md:11` (the merge-cleanup
  exception).

### `prflow` (`skills/workflow/prflow/`)

- **Purpose** (`SKILL.md:3`, `:13`): scan many PRs across accounts, classify each, keep a ledger,
  enforce rails, and act only through narrow allowlisted side effects.
- **Commands** (`SKILL.md:4`, `:19`): `scan`, `plan`, `watch`, `tick`, `status`, `pause`, `resume`,
  `recover`, `review list|show|post`, `import-legacy`, `config`.
- **Scripts / state**: `scripts/` (about 5,400 lines with tests), state in
  `${XDG_STATE_HOME}/prflow/` (`references/state.md`), drafts under `${state}/drafts/`.
- **GitHub operations**: read-only allowlist (`scripts/adapters/gh.ts:43-68`); rerun of cancelled runs
  (`SKILL.md:58`, `assertRerun`); one review POST (`SKILL.md:104`, `assertReviewPost`).
- **Orca operations**: launch and message Pi sessions, interrupt busy ones, create review worktrees,
  set statuses, move Blocked cards, archive worktrees (`SKILL.md:154`, `scripts/adapters/orca.ts`).
- **Briefs** (`templates/briefs/`): `ci`, `comments`, `behind`, `review`, `nudge`, `review-nudge`,
  `restart`. These tell sessions how to do the per-PR work.
- **Callers**: orca-orchestrator (`scripts/tick.ts:221-222`, `SKILL.md:61-68`), orca-task-status
  (writes `blocked.json`, which prflow reads; `SKILL.md:84`), shared config and `lib/`.

### Ownership by operation

| Operation | `pr` | `prflow` | Others |
| --- | --- | --- | --- |
| Read CI, classify failure | `ci.md:16-36` | `core/classify.ts:42-66` | `lib/task-status.ts:61-78` |
| Rerun cancelled CI | treated as failing (`merge.md:20`, `monitor.md:47`) | `SKILL.md:58` (does it) | — |
| Fix CI | `/pr ci` | `ci` brief steps (`briefs/ci.md:15-18`) | — |
| Review comments / threads | `/pr comments` (resolve, re-request) | `comments` brief (never resolve, never request) | orchestrator `SKILL.md:84`, `:106` |
| Rebase / out of date | `/pr rebase`, `restack`, `stack` | `behind` brief (`briefs/behind.md:15-19`) | — |
| Merge readiness | `merge.md`, `monitor.md:9` | `classify.ts:164` (`merge-ready`), `core/worktree-status.ts:27-39` | `lib/task-status.ts:99-117`; orchestrator `SKILL.md:69`, `:79` |
| Merge | `/pr merge` | never | orchestrator never |
| Worktree cleanup | `merge.md:52-60` (`--force`) | `SKILL.md:59` (archive) | orca-task-status `cleanup` (no `--force`) |
| Review drafting | `/pr review report` | reviewer brief calls it (`briefs/review.md:18`) | — |
| Review posting | `/pr review` (other author) | `prflow review post` | orchestrator manual `gh pr review` (`SKILL.md:67`) |
| Session briefs | — | `templates/briefs/` | orchestrator worker specs (`SKILL.md:74-80`) |

## 2. Overlaps with evidence

### O1. Thread resolution and reviewer re-request conflict (rule conflict, high)

- `skills/dev/pr/references/comments.md:30`: "Then resolve the thread via GraphQL `resolveReviewThread`
  if appropriate."
- `comments.md:31-32`: re-request eligible reviewers through the `requested_reviewers` API.
- `skills/workflow/prflow/templates/briefs/comments.md:20`: "Never resolve a review thread; the
  reviewer resolves it." `:27`: "Do not request or nudge reviewers."
- `skills/agent/orca-orchestrator/SKILL.md:84`: "They never resolve a thread"; `:106`: "Never resolve
  review threads, and never let a brief ask a session to."
- Test pins the brief rule: `skills/workflow/prflow/tests/brief.test.ts:54`.

### O2. Draft-before-changes vs. prflow's draft blindness (behavior conflict, high)

- `skills/dev/pr/references/gates.md:77`: convert an open non-draft PR to draft before the first edit,
  rebase, or push. `ci.md:21`, `comments.md:21`, `rebase.md:13`, and `review.md` `fix` all apply it.
- `skills/workflow/prflow/scripts/core/classify.ts:154`: `if (pr.isDraft) return [];` so a drafted PR
  has no triggers, and the dispatch monitor may record the work as done because "the trigger is gone"
  (`SKILL.md:83`).
- No prflow brief mentions draft state. A session that runs `/pr ci` or `/pr comments` on its own
  initiative leaves the PR in draft, and prflow stops reporting it.

### O3. Rebase procedure duplicated and weaker (duplicated instructions, medium)

- `templates/briefs/behind.md:15-19` re-implements: read current base, fetch, rebase, drop merged
  parent commits with `git rebase --onto`, push `--force-with-lease`.
- `skills/dev/pr/references/rebase.md:10-15` owns the same: pin base from PR metadata, stop for native
  stacks (`stack` non-null), delegate to `/git rebase` and `/git conflicts`, then the `/pr push`
  post-push steps (description refresh). `restack.md` owns "parent merged".
- The brief does not check native-stack membership and skips the description refresh.

### O4. CI fix steps duplicated, with a different rerun rule (duplicated instructions, medium)

- `templates/briefs/ci.md:15-18`: find cause, fix, normal push, stop.
- `skills/dev/pr/references/ci.md:16-24`: the same, plus root-cause grouping, validators, `/pr push`,
  and review of the fix head.
- Cancelled checks: prflow reruns them (`SKILL.md:58`, `classify.ts:63`, `:161`); `lib/task-status.ts:61`
  counts `CANCELLED` as failed; `pr merge.md:20` and `monitor.md:47` send cancelled checks to
  `/pr ci` as failures. The `ci` brief says "Never rerun CI by hand unless this repo's docs say"
  (`briefs/ci.md:24`).

### O5. Comment replies lack the disclosure (rule gap, medium)

- `skills/dev/pr/references/comments.md:27` and `disclosure.md:3-14`: every reply posted as the user
  starts with the agent disclosure.
- `templates/briefs/comments.md:20` asks the session to reply but never mentions the disclosure
  (no match for "disclosure" in any non-review brief).

### O6. Review drafting restates `/pr review` and diverges from it (duplicated instructions, medium)

- `templates/briefs/review.md:17` gathers context and diffs with
  `git diff $(git merge-base origin/<base> <head>)..<head>`.
- `skills/dev/pr/references/review.md:53`: "The PR comparison is always
  `git diff <baseRefOid>..<headRefOid>`. Never use a local base ref." (also `info.md:28`).
- `briefs/review.md:17` step 3 repeats `review.md:51-77` (source and context gathering). The brief
  then runs `/pr review <url> report` (`:18`), which gathers it again.
- `briefs/review.md:29-46` defines the draft's Summary and Inline content. `review.md:182-210` defines
  publishable content (no process internals, anchor rules, one point per PR). The brief keeps only
  part of those rules ("no process details"), so posted drafts can differ from what `/pr review`
  would publish.

### O7. Two (three) review publication paths (duplicated logic, medium-high)

- `/pr review <url>` (no mode, other author) publishes: event selection `review.md:231-242`,
  v2 marker and dedup `:219-230`, `:251-277`, post and verify `:279-288`.
- `prflow review post` publishes drafts: `SKILL.md:104`, `references/review.md:24-40`,
  `scripts/review-cmd.ts`, `scripts/core/draft.ts`. It dedups by "a commit the account already
  reviewed", writes no `pr-review` marker, and lets the user choose `approve` where `pr` would require
  a complete `clean` packet plus green CI (`review.md:235-238`).
- orca-orchestrator `SKILL.md:67` posts a changed verdict by hand with `gh pr review`, with the
  disclosure and approval-withheld rules restated inline.
- Disclosure text is hard-coded in `scripts/core/draft.ts:119-135` and restated in
  `orca-orchestrator/SKILL.md:67`, `:104`; the source is `pr/references/disclosure.md:5-7`.
- Effect: `/pr review <url>` and `prflow review post` on the same PR and head do not see each other's
  reviews as duplicates.

### O8. Merge readiness defined three ways (duplicated logic, medium)

- prflow `merge-ready`: `classify.ts:164`, `CLEAN` and `APPROVED`, no failed, cancelled, or pending check.
- `lib/task-status.ts:111-113` (orca-task-status Done, prflow unblock): `APPROVED` or empty review
  decision, and `CLEAN` or `HAS_HOOKS`; cancelled counts as failed.
- `pr` `monitor.md:9` `clean` and `merge.md:18-24`: expected required checks from branch policy,
  threads resolved, outcome and review evidence.
- orca-orchestrator worker spec (`SKILL.md:69`, `:79`): "approved, checks green, merge state clean".
- These disagree on `HAS_HOOKS`, on no-review-required repos, on cancelled checks, and on required vs.
  all checks.

### O9. Post-merge worktree cleanup has three owners and conflicting flags (rule conflict, medium)

- `pr merge.md:52-60`: remove the current worktree with `worktree rm ... --force`, no confirmation,
  even though the merge only checks the PR, not the tree.
- orca-task-status `SKILL.md:88`, `:109`: `cleanup` requires merged PR, clean tree, `HEAD` equal to the
  merged head, and "Never remove a worktree with `--force`".
- prflow `SKILL.md:59`: archives clean merged or closed worktrees later and deletes merged local
  branches.
- `harness/pi/APPEND_SYSTEM.md:11` and the orca-task-status addendum both grant cleanup exceptions,
  so an agent inside Orca that runs `/pr automerge` follows `merge.md` and skips the safer check.

### O10. Description and trigger overlap (routing, medium)

- `pr` `SKILL.md:3`: "...needs creation, reconciliation, remediation, publication, merge, or stack
  management."
- prflow `SKILL.md:3`: "Use when checking which PRs need a merge decision, a rerun, a CI or comment
  fix, a rebase, a review, or worktree cleanup..." The noun list matches `pr`'s actions, and the
  description does not say that prflow does not perform those fixes itself.
- The prflow description is 120 words; most of it describes internals the router does not need.

### O11. Two writers set the same card column with different rules (logic conflict, high; added after rebase onto #198)

#198 (`09a5867`) added prflow's worktree column sync: each tick sets a development worktree's card
from `openPrColumn` (`skills/workflow/prflow/scripts/core/worktree-status.ts:27-39`). orca-task-status
`end` sets the same card from `prDecision` (`lib/task-status.ts:99-117`, via
`skills/agent/orca-task-status/scripts/core.ts:19`). The rules differ:

| PR state | `prDecision` (agent `end`) | `openPrColumn` (prflow tick) |
| --- | --- | --- |
| `CLEAN`, no review required (`reviewDecision` empty) | Done | In Review |
| `HAS_HOOKS`, approved | Done | In Review |
| Cancelled check | Needs Attention (counted as failed, `:61`) | In Review |
| Unanswered review feedback | In Review or Done | Needs Attention |
| Draft | Needs Attention | left as is |

With `prflow.worktreeStatus.dryRun` off, an agent that ends on a no-review-required CLEAN PR sets
Done and the next tick moves it back to In Review. The orchestrator's prose rule (`SKILL.md:69`) is a
fifth version. Under D5, cancelled checks mean "rerun pending", which matches `openPrColumn`.

### Not overlaps (keep as is)

- `pr monitor` (one PR, in-session polling) and `prflow watch`/`tick` (many PRs, scheduled ledger)
  share a word, not a function.
- prflow's rails, ledger, Orca session management, unblock, and review worktrees have no `pr`
  counterpart.
- `pr create`, `description`, `screenshots`, `split`, `stack`, `verification`, `ready`, and `merge`
  have no prflow counterpart.

## 3. Boundary and target split

### Boundary rules

1. **pr owns every rule about acting on a PR**: CI fixes and reruns, threads, rebase and stacks,
   drafts and readiness, review content, review event and dedup, merge, and post-merge removal.
2. **prflow owns watching and handing off**: scan, classify, ledger, rails, dispatch, session
   management, review worktrees, draft storage and listing, board-column sync, unblock, and archive of
   worktrees no session uses.
3. **prflow states facts, not procedure.** A brief is the PR identity, the trigger details (failing
   jobs and log lines, exact feedback, base and head), and one `/pr` command. No steps, no
   PR rules, no "never resolve", "never force-push", or "stop after pushing".
4. **prflow labels GitHub facts as facts.** Its kinds describe what GitHub reports (for example
   `mergeable`: approved, checks green, merge state `CLEAN`). They are triggers for routing, never
   gates. Only `pr` decides readiness.
5. **prflow makes no PR-content writes.** No review posts, replies, or thread changes. Writes to a PR
   happen inside a `pr` run, with no exceptions: reruns included (D6).
6. **pr does not know prflow exists.** No prflow modes, flags, or wording in `pr`. prflow uses only
   `pr`'s public inputs: `/pr <url>`, `/pr review <url> report`, and `/pr review <url>` with a
   matching packet (`review.md:25`, `gates.md:13`).
7. **Shared `lib/` holds GitHub fact parsing and board rules shared by prflow and orca-task-status**,
   never `pr` policy.
8. **Other skills point, they do not restate.** orca-orchestrator and orca-task-status link to the
   owning skill for PR or prflow rules.

### Coupling surface (the only allowed contact points)

| prflow uses | Owned by `pr` |
| --- | --- |
| `/pr <url>` in `ci`, `comments`, `behind` briefs | Lifecycle: picks and runs unmet phases |
| `/pr review <url> report` in the reviewer brief | Report output (packet) |
| `/pr review <url>` with the saved packet, run by the posting agent | Publication: event, marker, dedup, disclosure |
| Reads PR state from GitHub (drafts, reviews, markers) | — |

### Changes

| # | Change | Deletes from prflow | Value | Effort | Risk |
| --- | --- | --- | --- | --- | --- |
| C1 | **Briefs are facts plus one command (D1, D4).** `templates/briefs/ci.md`, `comments.md`, `behind.md`: keep header and trigger details; "What to do" becomes "Run `/pr {{pr_url}}`". Delete every rule and step: rebase and `--force-with-lease` (`behind.md:15-19`), CI fix steps and "never rerun" (`ci.md:15-24`), "never resolve" and "do not request reviewers" (`comments.md:20,27`), "stop after pushing", branch and merge rules (pr guards both; bare `/pr` stops at merge-ready). Bump versions | ~40 brief lines | High | Low | Medium: longer sessions; verify on a live dry run |
| C2 | **prflow does not interpret draft state during its own dispatch.** An open prflow dispatch keeps the item `in-progress` whatever the PR's state; done detection waits for the session to finish, not for the trigger to vanish (`classify.ts:154`, `scripts/agents.ts` done check). prflow never needs to know why `pr` drafted the PR | — | High | Low | Low |
| C3 | **Reviewer brief.** Delete step 3 context gathering (`briefs/review.md:17`, a local merge-base that `pr` forbids) and the Summary/Inline content rules (`:29-46`). The draft file is `/pr review <url> report`'s packet plus prflow metadata (PR, head, account) | ~25 brief lines | Medium | Low | Low |
| C4 | **Publication moves to pr (D2).** Delete `prflow review post`, its payload builder, disclosure, moved-head downgrade, and `assertReviewPost` (`scripts/review-cmd.ts` post path, `scripts/core/draft.ts` payload and `DISCLOSURE`, `scripts/adapters/gh.ts:96`). The user's agent or the orchestrator (`autoPost`) posts by running `/pr review <url>` with the saved packet as the account; `pr` selects the event, writes the `pr-review: v2` marker, and dedups. prflow keeps `review list`/`show` and learns a draft was posted from GitHub (the account's review on that head, or the marker). Delete the manual `gh pr review` recipe at `orca-orchestrator/SKILL.md:67` | ~250 lines of code and tests; tick's only GitHub review write | High | Medium | Medium: changes the posting workflow; `pr` must accept a saved packet from another session (`gates.md:13` freshness applies) |
| C5 | **Reruns belong to pr (D5, D6).** `pr`: edit `ci.md` steps 2-3, `merge.md:20`, `monitor.md:47` so each cancelled run is rerun once per head (`gh run rerun <id> --failed`) before it counts as failed. prflow: delete the `rerun` action and kind (`scripts/actions.ts`, `core/classify.ts:161`, `core/report.ts`, `core/events.ts`, `core/types.ts`), `assertRerun` (`scripts/adapters/gh.ts:77`), the `rerunsPerVersion` rail (`core/config.ts`, `config.example.json:32`), and the rerun rows in `SKILL.md:60,146,169,173`, `references/dispatch.md`, `references/state.md`. Cancelled checks with nothing failing or pending become a `ci` trigger: a dispatch whose brief lists the cancelled jobs and runs `/pr {{pr_url}}`. prflow's tick then makes no GitHub writes at all; `assertReadOnly` covers every `gh` call. `prflow.actions` keeps only archive | Rerun action, guard, rail, ~100 lines of code and tests | Medium | Medium | Low: a session per cancelled run costs more than a rerun call (accepted by D6) |
| C6 | **prflow kinds are facts.** Rename `merge-ready` to `mergeable` in `core/classify.ts:183`, the report, the feed, and orca-orchestrator, and document it as GitHub state, not `pr` readiness. The merge decision still runs `/pr merge`, which applies its own gates | — | Medium | Low | Low: feed consumers |
| C7 | **One board-column rule in `lib/` (O8, O11).** `lib/pr-state.ts` holds check-state parsing (explicit `cancelled`) and one `prColumn` function. `prDecision` (`lib/task-status.ts`) and `openPrColumn` (`core/worktree-status.ts`) both call it; `unblock.ts` uses it. It encodes GitHub facts and board placement only: empty `reviewDecision` and `HAS_HOOKS` count as mergeable (GitHub enforces required reviews), cancelled is In Review, unanswered feedback is Needs Attention. Local dirty and HEAD checks stay in `prDecision`. Orchestrator `SKILL.md:69` points to it | Duplicate check parsing | High | Medium | Medium: card columns at the edges |
| C8 | **Post-merge removal (D3).** `pr merge.md:52-60` keeps `--force`. orca-task-status `cleanup` (outside the pr/prflow boundary, but same act) points to that rule and uses `--force` after its merged and HEAD checks, instead of keeping its own conflicting rule (`SKILL.md:88`, `:109`). prflow's archive of unused leftover worktrees is a different act and keeps no-`--force` | — | Medium | Low | Medium: uncommitted files in a merged worktree are lost (accepted) |
| C9 | **Descriptions and README** (below); rows at `README.md:56`, `:76` | Description nouns that name `pr` actions | Medium | Low | Low |
| C10 | **Orchestrator points, does not restate.** Replace PR rules at `orca-orchestrator/SKILL.md:67,69,84,104,106` with links to `pr` or prflow | Restated rules | Medium | Low | Low |

Removed from the earlier draft: caller constraints for `pr` (rule 6), and prflow applying `pr`'s
event rules or writing its markers (rule 5; replaced by C4). The shared disclosure constant is gone
with C4.

### Ranked order

1. C1, C2, C3: briefs become facts plus a command; prflow stops misreading drafts. Ship C2 first.
2. C5, C6, C10, C9: rule edits, renames, pointers.
3. C7: ship before `prflow.worktreeStatus.dryRun` is turned off.
4. C4: largest deletion; needs the posting workflow tested end to end.
5. C8.

### Description rewrites

`pr`:

> Acts on one pull request from its branch or worktree: creates, publishes, describes, rebases or
> restacks, fixes CI, handles review threads, reviews and publishes reviews, marks ready, merges, and
> manages stacks. Use when working on a specific PR or when asked to run a `/pr` command.

`prflow`:

> Watches open PRs, review requests, and leftover worktrees across accounts: classifies each, keeps a
> ledger behind safety rails, keeps worktree board columns in step with their PRs, unblocks Blocked
> cards, archives unused merged worktrees, and hands PR work and review drafting to Pi sessions that
> run the `pr` skill. Use when asking which PRs need attention, running or scheduling a tick, managing
> dispatches and pauses, or listing and showing review drafts.

The `pr` description no longer points at prflow (rule 6).

## 4. Decisions

| # | Question | Decision | Effect |
| --- | --- | --- | --- |
| D1 | Thread resolution and reviewer re-request | `pr` default; prflow states nothing about threads | C1 |
| D2 | Review event rules for posted drafts | `pr` default, applied by `pr` itself at publication | C4 |
| D3 | Post-merge worktree removal | Force removal, as `pr merge` does | C8 |
| D4 | Brief weight | Load the full `pr` workflow; consistency first. Gradual disclosure is a follow-up | C1, C3, section 7 |
| D5 | Cancelled checks | Rerun, owned by `pr` | C5 |
| D6 | prflow's own cancelled-check rerun (`gh run rerun --failed`, `assertRerun`) | Delete it; `/pr` reruns. Cancelled checks become a `ci` dispatch running `/pr <url>` | C5 |

## 5. Migration steps

1. C2, then C1 and C3: `core/classify.ts`, `scripts/agents.ts` with tests; rewrite briefs and bump
   versions; update `references/dispatch.md` brief table and `SKILL.md` Pi Dispatch. Run
   `prflow tick --dry-run` and read the announced briefs.
2. C5: the `pr` rerun rule first, then delete prflow's rerun action in the same release (otherwise cancelled checks have no owner). Then C6, C10, C9, in one bundled commit per skill where lock-step (AGENTS.md policy).
3. C7: `lib/pr-state.ts`; switch `lib/task-status.ts`, `core/worktree-status.ts`, `unblock.ts`.
4. C4: delete the post path and guards; update `references/review.md` (prflow), orchestrator step 5,
   and `SKILL.md` Review Drafts and Safety Rules; test `/pr review <url>` with a saved packet.
5. C8.
6. Re-run `install.sh`.

## 6. Tests affected

| Test | Why |
| --- | --- |
| `skills/workflow/prflow/tests/brief.test.ts:25-61` | Asserts brief rules that C1 and C3 delete (`Stop after pushing`, `--force-with-lease`, `Never resolve a review thread`); replace with assertions that briefs hold facts plus one `/pr` command and no rules |
| `skills/workflow/prflow/tests/review.test.ts` | Reviewer brief line (C3); post-path tests deleted (C4) |
| `skills/workflow/prflow/tests/draft.test.ts` | Payload, disclosure, and `assertReviewPost` tests deleted; draft parse kept (C4) |
| `skills/workflow/prflow/tests/classify.test.ts` | Open-dispatch drafts, `mergeable` rename, cancelled as `ci` (C2, C5, C6) |
| `skills/workflow/prflow/tests/actions.test.ts`, `adapters.test.ts`, `deps.test.ts`, `watch.test.ts`, `dispatch.test.ts`, `orca.test.ts`, `fixtures.ts`, `state-helpers.ts` | Rerun action, `assertRerun`, and rail removed (C5) |
| `skills/workflow/prflow/tests/legacy.test.ts` | `core/legacy.ts:29` maps the legacy `rerun` kind; map it to `ci` (C5) |
| `skills/workflow/prflow/tests/agents.test.ts`, `dispatch.test.ts` | Brief versions, done detection while drafted (C1, C2) |
| `skills/workflow/prflow/tests/unblock.test.ts`, `worktree-status.test.ts` | Shared column rule (C7) |
| `skills/agent/orca-task-status/tests/core.test.ts`, `cli.test.ts` | `prDecision` edges (C7), `cleanup` with `--force` (C8) |
| `skills/agent/orca-orchestrator/tests/*` | `merge-ready` to `mergeable` in the feed (C6) |
| `lib/tests/*` | New `lib/pr-state.ts` (C7); already run by each workspace's `npm test` |
| `.plans/unified-review/tests/test_unified_review_contract.py` | Asserts `pr` reference text; re-run after C5 |
| `install/tests/skill-links.test.sh` | Unchanged paths; re-run as a check |

## 7. Follow-up: PR information hierarchy

D4 accepts the full `pr` load per briefed session. A later change restructures `pr`'s references
for gradual disclosure: a short entry per phase that a session can follow alone, with gates,
stack, and review-publication detail loaded only when that path is taken. Measure before and
after with the context a `ci` brief session loads (`ci.md` pulls `gates.md`, `info.md`, `push.md`).

## 8. Build notes

Implemented as planned, with these review-driven adjustments:

- **Draft packet.** The reviewer brief keeps prflow's draft parse contract (one verdict word, `### <path>:<line>` headings, `None.`) and adds a verbatim `## Packet` section holding the `/pr review <url> report` output. Publication passes that section to `/pr review <url>` as the matching packet. A draft without it still parses; `/pr` then re-reviews instead of reusing it. `parseDraft` reads the verdict only from the header, so a quoted verdict in the packet cannot stand in.
- **Posted detection.** `review list`/`show` derive posted state from the account's reviews on GitHub. A row whose PR cannot be read shows `posted: unknown (<error>)` (JSON: `posted: null`, `postedError`) instead of aborting the list.
- **Untrusted data.** Briefs that embed PR text carry one data-boundary sentence. This is a fact about the input, not a `pr` rule.
- **Orchestrator authority.** The orchestrator's only `/pr` action is `/pr review <url>` to publish a ready draft; it never runs `/pr merge`, `/pr automerge`, or `force`.
- **Cancelled checks and Blocked cards.** With another condition, cancelled checks leave `checks-pass` unmet. A `checks-pass`-only record still always holds (CI waits are In Review).
- **Config migration.** prflow rejects unknown rails keys, so existing configs must drop `rerunsPerVersion`; `SKILL.md` says so.
- **Residual (R7).** orca-task-status `end` passes `feedback: false` because `gh pr view` cannot report unanswered feedback; on a CLEAN PR with unanswered feedback, `end` and prflow can still disagree. Closing it needs a GraphQL read in orca-task-status.
- **Own drafts in reports.** The authored scan now includes drafts so a dispatch can follow a PR its session drafted; reports (`plan`, `watch`, `tick`) leave own drafts out, as before.
- **Live check.** `prflow plan` (read-only) against the real accounts: an approved, green, `CLEAN` PR reports as `mergeable`; a PR with only cancelled checks reports `ci` with `cancelled: <jobs>` and would get a `/pr` brief; own drafts no longer appear; drafts requested for review still do. No live `tick` was run, so no brief was sent.
