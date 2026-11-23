# Plan: deduplicate the `pr` and `prflow` skills

Status: decisions recorded (section 4); re-analyzed after rebase onto `09a5867` (#198, O11); not implemented. Branch: `prflow-pr-dedup`.
Paths are relative to the repository root.

## Summary

The two skills overlap less in code than in rules. `pr` is prose only (`skills/dev/pr/`, no scripts).
`prflow` is a TypeScript CLI (`skills/workflow/prflow/`) whose Pi briefs restate, in a shorter and
sometimes contradicting form, the steps that `pr` owns: fixing CI, answering review comments,
rebasing, and drafting a review. Three other places (orca-orchestrator, orca-task-status, and
`lib/task-status.ts`) add their own versions of merge readiness, thread policy, and worktree cleanup.

Direction (decided): `pr` is the single source of truth for acting on a PR, and its defaults win
every conflict. prflow watches, classifies, and dispatches; its briefs pass the exact trigger
details and have the session run the full `pr` workflow. Consistency comes before brief size;
a later pass reworks the PR information hierarchy for gradual disclosure (section 7).

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

## 3. Target split

- **`pr` owns acting on one PR** from its branch or worktree: create, publish, describe, rebase,
  restack, stack, fix CI (including cancelled-check reruns), handle threads (reply, resolve,
  re-request), review (draft or publish, with event selection and dedup), ready, merge, and
  post-merge worktree removal. Its defaults are the policy everywhere.
- **`prflow` owns watching many PRs**: scan, classify, ledger, rails, rerun of cancelled CI as a
  scheduled side effect, unblock, dispatch to sessions, reviewer sessions and review worktrees,
  draft storage, the guarded post command, and archive of leftover worktrees. Its briefs say *what*
  is wrong, with the exact feedback, and run the full `pr` workflow. They never restate or narrow
  `pr` steps.
- **Other skills** (orca-orchestrator, orca-task-status) point to `pr` for PR rules instead of
  restating them.
- **Shared code** (`lib/`): PR-state facts used by scripts (check state including `cancelled`,
  merge readiness, disclosure text). `pr` is prose; the code implements the definitions `pr` states.

### Changes

| # | Change | Value | Effort | Risk |
| --- | --- | --- | --- | --- |
| C1 | **Thread policy = `pr` default (D1).** Delete "Never resolve a review thread" and "Do not request or nudge reviewers" from `templates/briefs/comments.md:20,27`; replace the rules at `orca-orchestrator/SKILL.md:84,106` with a pointer to `pr/references/comments.md`. Update `tests/brief.test.ts:54` | High | Low | Low |
| C2 | **Briefs run the full `pr` workflow (D4).** Rewrite `templates/briefs/ci.md`, `comments.md`, `behind.md`: keep the header and trigger details (prflow's value), replace the "What to do" steps with "Run `/pr {{pr_url}}`" (the lifecycle, which detects and runs the unmet phases: `ci`, `comments`, `rebase`/`restack`, review rounds, `ready`, monitor, ending at merge-ready). Keep only prflow-specific session rules: stay on `{{branch}}`, never merge, report back. Delete the brief's own rebase and force-push rule (`behind.md:15-19`). Bump each template version | High | Medium | Medium: longer sessions, more context; verify on a live dry run |
| C3 | **Drafts during a dispatch (D4 consequence).** `pr` drafts the PR before changes (`gates.md:77`) and restores it through `/pr ready`. prflow must keep tracking it: `classify.ts:154` and the dispatch monitor treat a draft PR with an open prflow dispatch as `in-progress`, not as "trigger gone, done". Drafts with no prflow dispatch stay ignored | High | Low | Low |
| C4 | **Review brief (D4).** Delete step 3 context gathering (`briefs/review.md:17`, which uses a local merge-base that `pr review.md:53` forbids). Keep "confirm HEAD", "run `/pr review <url> report`", and the draft file format; the draft's Summary and Inline rules point to `pr/references/review.md:182-210` | Medium | Low | Low |
| C5 | **One review publication engine with `pr` rules (D2).** `prflow review post` applies `pr`'s event selection (`review.md:231-242`: approve only on a complete `clean` packet with green CI, else comment or request changes), writes the `pr-review: v2` marker (`review.md:219-230`), and skips a post whose marker already exists (`:251-277`). `--event` can lower the event, never raise it past what `pr` allows. Add a changed-verdict path and delete the manual `gh pr review` recipe at `orca-orchestrator/SKILL.md:67`. Update `assertReviewPost` tests | Medium-high | Medium | Medium: GitHub write path |
| C6 | **Cancelled checks are rerun (D5).** `pr` reruns each cancelled run once per head (`gh run rerun <id>`, failed jobs only) before treating it as failed: edit `ci.md` steps 2-3, `merge.md:20`, `monitor.md:47`. prflow keeps its scheduled rerun and its `ci` brief drops "Never rerun CI by hand" (`briefs/ci.md:24`). A run already rerun once on this head counts as failed | Medium | Low | Low |
| C7 | **Shared PR-state module and one card-column rule (fixes O8, O11).** `lib/pr-state.ts` holds `checkState` with an explicit `cancelled` state, a `mergeReady` predicate matching `pr`'s rules, and one `prColumn` function. `prDecision` (`lib/task-status.ts`) and `openPrColumn` (`core/worktree-status.ts`) both become thin callers of `prColumn`; `core/classify.ts` (`merge-ready`) and `unblock.ts` use `mergeReady`. Settle the table in O11 once: accept empty `reviewDecision` and `HAS_HOOKS` as ready (GitHub enforces required reviews), cancelled = In Review (D5), unanswered feedback = Needs Attention, draft = left as is for prflow and Needs Attention for the agent's own `end` (local dirty/HEAD checks stay in `prDecision`). The orchestrator worker spec (`SKILL.md:69`) points to it | High | Medium | Medium: changes card columns and report kinds at the edges |
| C8 | **Disclosure constant** in `lib/disclosure.ts`, used by `core/draft.ts`; the orchestrator text (`SKILL.md:67,104`) points to `pr/references/disclosure.md` | Low | Low | Low |
| C9 | **Post-merge removal = `pr merge` force removal (D3).** `pr merge.md:52-60` stays the rule. orca-task-status `cleanup` aligns with it: remove with `--force` once the PR is merged and local `HEAD` equals the merged head (no unpushed work), dropping the clean-tree precondition and the "never `--force`" safety rule (`SKILL.md:88`, `:109`). Keep the never-`--delete-branch` rule. Update `harness/pi/APPEND_SYSTEM.md:11`, `harness/omp/APPEND_SYSTEM.md:11` only if wording changes | Medium | Low | Medium: uncommitted files in a merged worktree are discarded (accepted by D3) |
| C10 | **Descriptions and README** (below), rows at `README.md:56`, `:76` | Medium | Low | Low |
| C11 | **CI coverage gap.** Add `lib/tests` to the `.github/workflows/ci.yml` matrix | Low | Low | Low |

### Ranked order

1. C1, C6: rule-only changes that remove live conflicts.
   C7's column rule (O11) is also live once `prflow.worktreeStatus.dryRun` is off; ship it before turning that on.
2. C2, C3, C4: briefs run `pr`; prflow follows drafts it caused. Ship C3 with or before C2.
3. C10, C11.
4. C8, C7: code dedup with tests.
5. C9, then C5: session-ending and GitHub write paths last.

### Description rewrites

`pr`:

> Acts on one pull request from its branch or worktree: creates, publishes, describes, rebases or
> restacks, fixes CI, handles review threads, reviews, marks ready, merges, and manages stacks. Use
> when working on a specific PR yourself or when a brief asks you to run a `/pr` command. For
> watching many PRs or dispatching PR work to sessions, use prflow.

`prflow`:

> Watches open PRs, review requests, and leftover worktrees across accounts: classifies each, keeps a
> ledger behind safety rails, reruns cancelled CI, archives merged worktrees, unblocks Blocked cards,
> keeps worktree board columns in step with their PRs, and briefs Pi sessions and reviewer sessions that do the work with the `pr` skill. Use when asking
> which PRs need attention, running or scheduling a tick, managing prflow dispatches and pauses, or
> listing, showing, or posting review drafts. Not for fixing one PR yourself; use pr.

## 4. Decisions

| # | Question | Decision | Effect |
| --- | --- | --- | --- |
| D1 | Thread resolution and reviewer re-request | `pr` default: resolve threads and re-request reviewers | C1 |
| D2 | Review event rules for posted drafts | `pr` default event selection | C5 |
| D3 | Post-merge worktree removal | Force removal, as `pr merge` does | C9 |
| D4 | Brief weight | Load the full `pr` workflow; consistency first. Gradual disclosure is a follow-up | C2, C3, C4, section 7 |
| D5 | Cancelled checks | Rerun | C6, C7 |

## 5. Migration steps

1. C1, C6: edit `templates/briefs/comments.md`, `ci.md` (bump versions), `orca-orchestrator/SKILL.md`,
   `pr/references/ci.md`, `merge.md`, `monitor.md`. Bundle in one commit: the brief and `pr` rules
   are lock-step (AGENTS.md commit policy).
2. C3 then C2, C4: `core/classify.ts`, `scripts/agents.ts` draft handling with tests; rewrite
   `ci.md`, `comments.md`, `behind.md`, `review.md` briefs; update `references/dispatch.md` brief
   table and `SKILL.md`. Run `prflow tick --dry-run` and read the announced briefs.
3. C10, C11: descriptions, `README.md`, `ci.yml`.
4. C8, C7: `lib/disclosure.ts`, `lib/pr-state.ts`; switch `core/draft.ts`, `core/classify.ts`,
   `unblock.ts`, `lib/task-status.ts`; lib tests.
5. C9: orca-task-status `cleanup` script and `SKILL.md`; harness prompts if wording changes.
6. C5: post path in `core/draft.ts`, `review-cmd.ts`, `adapters/gh.ts`; drop the orchestrator recipe.
7. Re-run `install.sh` to refresh installed skills.

## 6. Tests affected

| Test | Why |
| --- | --- |
| `skills/workflow/prflow/tests/brief.test.ts:25-61` | Asserts brief text (`Stop after pushing`, `--force-with-lease`, `Never resolve a review thread`, `/pr review ... report`, version headers) (C1, C2, C4) |
| `skills/workflow/prflow/tests/review.test.ts:98` | Reviewer brief's `/pr review` line (C4) |
| `skills/workflow/prflow/tests/draft.test.ts`, `review.test.ts` | Disclosure, marker, event selection, post payload (C5, C8) |
| `skills/workflow/prflow/tests/classify.test.ts` | Draft-with-dispatch, check summary, `merge-ready` (C3, C7) |
| `skills/workflow/prflow/tests/unblock.test.ts` | `prDecision`/`checkState` (C7) |
| `skills/workflow/prflow/tests/agents.test.ts`, `dispatch.test.ts` | Brief versions, rendered briefs, done detection on drafts (C2, C3) |
| `skills/workflow/prflow/tests/worktree-status.test.ts` | Card columns from PR state (C7; added by #198) |
| `skills/agent/orca-task-status/tests/core.test.ts`, `cli.test.ts` | `prDecision` edges (C7), `cleanup` force removal (C9) |
| `lib/tests/shared.test.ts`, `blocked.test.ts` | New lib modules (C7, C8); add to CI (C11) |
| `.plans/unified-review/tests/test_unified_review_contract.py` | Asserts `pr` reference text; re-run after C6 |
| `install/tests/skill-links.test.sh` | Unchanged paths; re-run as a check |

## 7. Follow-up: PR information hierarchy

D4 accepts the full `pr` load per briefed session. A later change restructures `pr`'s references
for gradual disclosure: a short entry per phase that a session can follow alone, with gates,
stack, and review-publication detail loaded only when that path is taken. Measure before and
after with the context a `ci` brief session loads (`ci.md` pulls `gates.md`, `info.md`, `push.md`).
