# Plan: refactor the `pr` skill into a state machine, actions, and scripts

Status: built (uncommitted), validated in two independent review rounds; see Build record. Branch: `feat/refactor-pr`. Baseline: `acbe758`.

## Outcome

Agents that run `/pr` get one copy of each rule and no rules that contradict each other. The
lifecycle state machine lives in one place, and each phase reference describes only its action.
Mechanical GitHub, git, and Orca steps run as tested scripts that print JSON, so they give the same
result every time. `pr` records per-PR run state (review packets, rounds, described heads, reruns)
in a shared store that prflow reads, so prflow can see review coverage and round use without
re-implementing `pr` rules. Callers (prflow briefs, orchestrator, `idea-to-pr`, `review-code`,
harness prompts) keep working with unchanged invocation strings.

## Acceptance

Must pass. "Scripts" means `skills/dev/pr/scripts/`. "Skill docs" means every `*.md` under
`skills/dev/pr/`.

- **A1** (code) WHEN `npm test` runs in `skills/dev/pr`, `skills/workflow/prflow`,
  `skills/workflow/repo-sync`, `skills/agent/orca-task-status`, and `skills/agent/orca-orchestrator`
  THEN every suite passes, and `bash install/tests/install.test.sh` passes. Regression: existing
  prflow tests, including `tests/brief.test.ts`, `tests/review.test.ts`, and `tests/agents.test.ts`,
  pass without any edits to their expected strings.
- **A2** (code) WHEN `wc -l` totals the skill docs THEN the total is ≤ 1290 lines, which is at least
  30% below the 1843-line baseline. Script source and tests do not count.
- **A3** (code) WHEN `skills/dev/pr/tests/directives.test.ts` runs THEN each owned rule in its table
  matches only in its owner file. The table holds one regex per rule: "Follow CLAUDE.md/AGENTS.md",
  "default tool is gh", the mutation guard, draft-before-changes, force definition, round limit,
  blocked form, force-push policy, required-check discovery, thread snapshot query, disclosure
  scope, and squash subject. The test fails on the baseline tree, which is the before-change check.
- **A4** (code) WHEN `grep -rn prflow skills/dev/pr` runs THEN it prints nothing. This restores
  `prflow-pr-dedup` A12.
- **A5** (code) WHEN any script subcommand runs THEN it prints one JSON object on stdout and exits 0,
  or exits non-zero with `blocked: <gate> — <evidence>; unblock requires: <state>` on stderr. Fixture
  tests cover success, the blocked case, and an API failure for each subcommand. An API, auth,
  pagination, or rate-limit failure never yields a passing result.
- **A6** (code) WHEN `pr next` gets a fixture snapshot and run state for each phase 0-10 THEN it
  returns that phase as the first unmet phase. WHEN only a judgment test is open, for example a
  possibly stale description, THEN it returns `needs_judgment` and names the test. Running it twice
  on the same input gives the same output.
- **A7** (code) WHEN `pr authorize <action> [mode] [force]` runs against fixtures for own, other,
  and fork PRs THEN it returns the allowed mutations from one data table. A test asserts that the
  `SKILL.md` authorization table equals that data table.
- **A8** (code) WHEN two processes write run state for the same PR at the same time THEN both
  updates are present afterwards, and a reader never sees a partial file. Test with `lib/pr` store
  tests. Run state round-trips: a write followed by a read returns an equal object.
- **A9** (code) WHEN prflow runs `scan` or `plan --format json` on a fixture PR that has a `pr` run
  state THEN the item shows the stored packet verdict and head, the rounds used, and the last
  completion. Its kind and dispatch decision are the same with and without that state.
- **A10** (code) WHEN `pr merge` sees required checks that stay pending THEN it waits at most 30
  minutes and then reports `pending` without merging. WHEN `force` is set THEN it takes one check
  snapshot, records pending checks as overridden, and merges. Test with a fake clock and fake `gh`.
- **A11** (code) WHEN `pr merge` gets a title that already ends in ` (#N)` THEN the subject has the
  suffix once. WHEN the merge only queues THEN the result is not `merged` and cleanup does not run.
- **A12** (code) WHEN `pr cleanup` runs in a fixture of a primary checkout, a linked Orca worktree,
  Orca unavailable, `selector_not_found`, and a git/Orca conflict THEN it returns `primary`,
  `remove:<id>`, `skipped (Orca unavailable)`, `skipped (outside Orca)`, and
  `cleanup failed: <reason>`, in that order. It never targets a selector other than `id:<captured>`.
- **A13** (code) WHEN `pr body` gets a `gh pr edit` failure on `projectCards` THEN it retries
  through REST PATCH, re-reads the PR, and confirms the body. Every body edit in the skill docs
  calls `pr body` or `pr attach`, and `grep -rn "gh pr edit\|pulls/<number> -F body" skills/dev/pr/*.md skills/dev/pr/references`
  prints nothing.
- **A14** (judge) Each conflict in Decisions D4-D12 has one resolution, stated once in its owner
  file. No other skill doc states the losing version. The reviewer cites file and line for each.
- **A15** (code) WHEN `grep -rnE '/pr (info|create|push|description|screenshots|rebase|restack|split|stack|ci|review|comments|verification|ready|merge|automerge)?'`
  runs over `skills/ agents/ harness/` outside `skills/dev/pr` THEN every invocation form it prints
  is still declared in `SKILL.md`'s `argument-hint` and action table.
- **A16** (code) WHEN the stack docs are counted THEN `references/stack-cli.md` and
  `references/stack-rest-api.md` no longer exist, and the stack docs total ≤ 120 lines.

Nice to have:

- **A17** (human) A bare `/pr` run on a real own PR in this repo reaches `complete` or `pending`, and
  its output lists the phases run and the run id.

## Decisions

All dated 2026-11-24 and answered by the user unless marked otherwise.

- **D1 Shared run state.** `pr` writes per-PR run state to a shared store through `lib/pr/`, and
  prflow reads it. Reason: prflow sees coverage and rounds without owning `pr` rules, and
  `lib/blocked.ts` already uses the one-writer, prflow-reads pattern. Rejected: prflow's SQLite (it
  is private to prflow), and context-only state (prflow cannot see it).
- **D2 Boundary.** Keep the #199 boundary. Shared code lives in `lib/`. `pr` docs never name prflow.
  prflow reads `pr` state but adds no classification rule from it. Rejected: letting `pr` name
  prflow.
- **D3 Behavior changes allowed.** Each conflict resolves to the winning rule (D4-D12). Rejected: a
  pure refactor with the conflicts deferred.
- **D4 Missing PR.** `description` and `screenshots` run `/pr create` when no PR exists, instead of
  stopping to suggest it. Reason: "act, don't refuse".
- **D5 Missing evidence in `ready`.** `ready` runs the missing phase within the current run's round
  budget. Delete `ready.md`'s "blocked, not permission to launch another review loop".
- **D6 Force.** Try each soft gate once, then override it and record it. One definition, in
  `policy.md`.
- **D7 Merge wait.** `merge` polls pending required checks for at most 30 minutes, then reports
  `pending` and does not merge. Under `force` it takes one snapshot and overrides the pending
  checks. Rejected: 60 minutes, and no limit.
- **D8 Decision order.** One ladder in `SKILL.md`. Reversible implementation choices are made and
  recorded. Product or architecture decisions the evidence cannot settle stop as `blocked`. `ci`,
  `comments`, and `policy.md` link to the ladder and do not restate it.
- **D9 Run ownership.** Each top-level invocation starts one run (`pr run start`), which owns the
  five-round budget. Phases and delegates inherit the run id. Bare `/pr` and `automerge` share one
  budget across phases 5-8. This settles the missing initializer for the lifecycle.
- **D10 Draft before changes.** The guard script converts the PR to draft before the first
  mutation and records `drafted_for_changes`. `pr push` checks the flag on every push path,
  including pushes after rebase, restack, and stack.
- **D11 Body edits.** Every PR body edit goes through `pr body` (REST fallback, re-read).
  `description` keeps the `## Evidence` section that `verification fix` writes.
- **D12 Policy surfaces.** `policy.md` names policy surfaces generically: this skill's own
  directory and any file the repository or harness loads as agent instructions. It does not
  hardcode `skills/dev/pr/**`.
- **D13 Delivery.** One PR. Rejected: a stack of four PRs.
- **D14 Stack docs.** Remove what is not needed and simplify what is. Deterministic stack steps move
  to `pr stack` script subcommands. `stack-cli.md` and `stack-rest-api.md` are deleted. One short
  `stack.md` keeps the operation table, merge semantics, and safety rules.
- **D15 Authorization.** One authorization table in `SKILL.md`, backed by a data table that
  `pr authorize` evaluates (A7).
- **D16 Success measure.** As proposed: each rule stated once, tests pass, caller strings
  unchanged, and the skill docs at least 30% smaller (A1-A3, A15).

- **D17 Caller path updates** (2026-11-24, build). `gates.md` was split, so five caller texts that named
  `references/gates.md` now name `policy.md` or `state.md`: `idea-to-pr/SKILL.md`,
  `prflow/templates/briefs/review.md`, `prflow/references/review.md`, `review-code/SKILL.md`, and
  `review-code/references/caller-contract.md`. Invocation strings are unchanged. This extends S6.
- **D18 Extra script subcommands** (2026-11-24, build). Validation showed that dropped procedures
  needed scripts: `packet put|get`, `react add|remove`, `review post`, `thread reply|resolve`, and
  `merge --required <check...> [--no-required-checks --policy-proof <text>]`. Mutating subcommands
  check the run's action, mode, and PR owner against the authorization table.
- **D19 Stack docs** (2026-11-24, build). `stack-workflows.md` was also folded into `stack.md`
  (one stack doc). Operational `gh stack` commands stay direct CLI calls; the doc lists their exit
  handling. Only `probe`, `link`, and `collapse-check` are scripted.

## Assumptions

The user can veto any of these.

- **S1 Language.** Scripts are TypeScript on Node ≥ 22.18 type stripping, with the tsconfig and test
  layout of prflow. Shared code goes in `lib/pr/`, imported by relative path, as `AGENTS.md` asks.
- **S2 Store location.** `${XDG_STATE_HOME:-~/.local/state}/agentic-tools/pr/<owner>-<repo>-<n>.json`,
  which sits next to `blocked.json`. Writes use the lock-and-rename pattern of `lib/blocked.ts`.
  Only `pr` scripts write. Stale runs expire after 7 days.
- **S3 State contents.** The PR identity; runs (id, action, mode, force, started, round, limit,
  `drafted_for_changes`, completion); packets keyed by base, head, and policy (depth and reason,
  verdict, finding ids and categories, coverage rows); described heads; cancelled-check reruns per
  head; and last completion. Review prose and secrets are never stored. A packet in the store is a
  reuse candidate, and reuse still needs an exact identity match.
- **S4 Other authors' PRs.** Bare `/pr` on another author's PR runs phase 0 and then `review report`,
  and stops. Phases 1-5 and 7-10 do not apply. Publishing still needs a mode-less explicit
  `/pr review`.
- **S5 Stacks.** `automerge` on a native-stack member stops `blocked` with the PR URL, because
  stacked PRs merge only in the web UI.
- **S6 `improve.md`.** `harness/pi/prompts/improve.md` invokes `/pr create` instead of raw
  `gh pr create`. This is the only caller text that changes.
- **S7 Judgment stays in prose.** Review depth, triage, description writing, CI root-cause
  classification, and choosing the required-check policy stay in prose. `pr checks` only fetches and
  matches the check data. The agent decides whether a check is required and whether a skipped
  check counts.
- **S8 Disclosure.** `disclosure.md` folds into `policy.md`. `pr disclosure` prints the header.
- **S9 Plan location.** `.plans/pr-refactor/proposal.md` follows the existing tracked `.plans/<slug>/`
  layout.

## Evidence

- **E1 Baseline size.** `find skills/dev/pr -type f | xargs wc -l` gives 1843 lines over 22 files.
  The biggest are `review.md` (347), `screenshots.md` (166), `stack-cli.md` (157),
  `stack-workflows.md` (141), and `gates.md` (109). There is no `scripts/` directory.
- **E2 Repeated rules.** These are each stated in many files:
  - "Follow CLAUDE.md/AGENTS.md on conflict": 16 files.
  - Ownership, branch, HEAD, and clean-tree guard: 9 files.
  - Draft-before-changes: 9 files.
  - Force-push rules: 8 files, with 4 different wordings.
  - Force definition: `SKILL.md`, `gates.md`, `lifecycle.md`, `ready.md`, `merge.md`.
- **E3 Conflicts, read in source:**
  - `description.md` and `screenshots.md` say "stop and suggest `/pr create`", and `SKILL.md` says
    "Act, Don't Refuse".
  - `ready.md` Required Inputs say missing evidence is blocked, and `ready.md` step 2 says to run
    the missing phase.
  - Force is worded three ways: "recorded, not fixed" in `SKILL.md`, "first try once" in
    `gates.md`, and "instead of waiting or blocking" in `lifecycle.md`.
  - `merge.md` polls every 60 seconds with no limit.
  - `ci.md` says "report the options and do not choose", and `SKILL.md` decision step 4 says to
    choose.
  - `gates.md` starts round state only for `review fix`, `ci`, and `comments`.
  - `push.md` turns a missing `drafted_for_changes` into a dead-end block.
  - `verification.md` edits the body without the REST fallback.
  - `gates.md` hardcodes `skills/dev/pr/**`.
- **E4 prflow mentions in `pr`.** `grep -rn prflow skills/dev/pr` matches `lifecycle.md:5,31,53`,
  `ready.md:20`, and `gates.md:67`, all added after #199 (`acbe758`, #206). That plan's A12 forbids
  them.
- **E5 Callers:**
  - prflow briefs `ci.md`, `comments.md`, and `behind.md` (line 18) and `nudge.md` (line 4) use
    `/pr {{pr_url}}`.
  - `templates/briefs/review.md` uses `/pr review {{pr_url}} report`, which tests pin.
  - `skills/agent/orca-orchestrator/SKILL.md` uses a mode-less `/pr review <pr_url>`.
  - `skills/workflow/idea-to-pr/SKILL.md:98` uses `create`, `push`, and bare `/pr`.
  - `review-code/references/caller-contract.md` and `visual-capture` call `/pr screenshots` and
    `/pr description`.
  - `/pr info` is used by `git/references/changes.md`, `scope`, `issue-create`, `refactor/simplify`,
    and `agents/reviewer.md:69`.
  - `harness/{pi,omp}/APPEND_SYSTEM.md:11` points to the `merge.md` cleanup conditions.
  - `harness/pi/prompts/improve.md:47` uses raw `gh pr create`.
  - Nothing registers `/pr` as a prompt template. It is reached by skill-name resolution (the
    symlink from `install/modules/artifacts.sh`).
- **E6 prflow runtime.** `skills/workflow/prflow/package.json` sets `engines.node >=22.18.0` and
  runs `tsc --noEmit` plus `node --test` over its own tests and `lib/tests`.
  - State is SQLite at `${XDG_STATE_HOME}/prflow/`, keyed by `owner/repo#N`.
  - `PrSnapshot` is in `scripts/core/types.ts`, the PR GraphQL query and parser are in
    `scripts/adapters/gh.ts`, and `summarizeChecks` and `unansweredFeedback` are in
    `scripts/core/classify.ts`.
  - `gh.ts` `assertReadOnly` blocks writes from tick.
- **E7 Shared-store pattern.** `lib/blocked.ts` already has one writer (`orca-task-status`) and
  prflow as a reader, under `${XDG_STATE_HOME}/agentic-tools/` with a lock file and an atomic
  rename. `lib/task-status.ts` re-exports `checkState` from `lib/pr-state.ts`, so there is a single
  implementation and no duplicate.
- **E8 Stack docs.** `stack-cli.md` and `stack-rest-api.md` are condensed copies of upstream gh-stack
  docs. The parts the workflow uses are the TUI traps, the exit codes, the T2 REST calls, and the
  merge semantics in `stack-workflows.md`.

## Approach

**Layout.** `SKILL.md` is the router. It holds:
- the action and argument grammar;
- the authorization table (D15);
- the decision ladder (D8);
- the script entrypoint;
- the output contract.

`references/` holds three shared documents:
- `lifecycle.md` holds only the state machine: phases, entry tests (deterministic ones marked as
  `pr next`), transitions, completion states (`complete`, `pending`, `forced`, `blocked`), and run
  ownership (D9).
- `state.md` defines the run-state schema (S3) and the invalidation rules. A head or base change
  invalidates head-bound evidence, and converting to draft invalidates readiness.
- `policy.md` holds each shared rule once. It replaces the policy half of `gates.md` and
  `disclosure.md`.

Each phase reference keeps only inputs, steps, outputs, and links to `policy.md`. Each step that is
mechanical names its script subcommand.

**Script contract.** `skills/dev/pr/scripts/pr.ts` is one CLI with subcommands that print JSON:
- PR facts: `snapshot`, `next`, `authorize`.
- Run state: `run start|get|update|end`.
- Guards: `guard`, `draft`.
- Threads and reviewers: `threads`, `rerequest`.
- Checks: `checks inventory|rerun-cancelled|wait`.
- PR edits: `body`, `attach`.
- Merge: `merge`, `cleanup`.
- Review publishing: `marker`, `disclosure`.
- Validation and stacks: `docs-only`, `stack probe|link|collapse-check`.

Every write to GitHub goes through an allowlist in the script. Agents pass the `run` id to each
mutating subcommand, so the round state and `drafted_for_changes` are read from the store and
never from memory.

**Shared library.** `lib/pr/` holds the PR GraphQL query and parser, `PrSnapshot`, the check summary,
feedback detection, and the run-state store (reader and writer API). prflow switches its adapters
and classifier to `lib/pr/` with no change in behavior, and its read-only `assertReadOnly` stays in
prflow. prflow reads the store only to show the run state in its scan, plan, and report output (A9).

**Order of work.**
1. Move the shared facts to `lib/pr/` and switch prflow to them, keeping prflow tests green.
2. Add the store and the scripts with fixture tests.
3. Rewrite the docs around the scripts, apply D4-D12 and D14, and remove the prflow mentions.
4. Add `directives.test.ts` and the size and caller checks last, so that they fail on the old tree
   and pass on the new one.

## Risks and unknowns

- **R1 Caller drift.** Callers depend on exact strings: prflow brief tests, `APPEND_SYSTEM.md`'s
  `merge.md` pointer, and the `/pr info` contract. Detect with A1 and A15. Keep `merge.md` as the
  file name for the cleanup conditions.
- **R2 Concurrent writes.** A prflow-dispatched session and a manual `/pr` can write the same PR's
  state. Detect with A8. Use the `lib/blocked.ts` locking pattern, and key runs by run id so that
  two runs never share a round budget.
- **R3 Agents skip scripts.** An agent can do a step by hand instead of running its script, and the
  state then drifts. Make each mutating subcommand check the run id and refuse without it. Reference
  steps name the subcommand, not the raw `gh` command.
- **R4 Over-scripting judgment.** The required-check policy and description staleness need judgment.
  `pr next` returns `needs_judgment` instead of guessing (A6, S7).
- **R5 One large PR (D13).** The diff touches a policy surface, so review is `deep` and long. Keep
  commits split by order-of-work step so the reviewer can read them one at a time.
- **R6 Stale state.** A stored packet for an old head could be reused. Reuse requires the exact
  base, head, and policy identity. Runs expire after 7 days (S2).
- **R7 The skill runs from a symlink.** `/pr` runs from the installed symlink, so script paths must
  resolve relative to the skill directory. Detect by running `install.sh` and calling the script
  through the installed path.

## Out of scope

- Changing what any subcommand is for, or adding or removing subcommands.
- Changing prflow's classification, dispatch rules, or SQLite schema.
- The content rules of review publication (event choice, what may be posted). Only the marker and
  dedup mechanics move to scripts.
- `review-code`, `risk-review`, and `verification` skill internals.
- The `.plans/` history files that mention `/pr monitor` or a three-round limit.

## Open questions

None.

## Build record

2026-11-24. Baseline `acbe758`; all suites green before edits, new checks failing (1843 doc lines,
7 `prflow` mentions, stack-cli/stack-rest-api present, no directives test).

Result: skill docs 645 lines / 8102 words (baseline 1843 / 23673). Scripts in
`skills/dev/pr/scripts/` (lizard CCN ≤ 10). Tests: pr 114, prflow 402, repo-sync 82,
orca-task-status 29, orca-orchestrator 29, lib 24, installer test pass. Read-only live smoke on
PR #207: `snapshot`, `threads`, `checks inventory`, and `prflow scan` succeed.

Validation round 1 found a live `gh` parsing bug, a wrong authorization table, and dropped
rules (23 items). Round 2 confirmed them resolved and found an invalid `PR_QUERY` brace, missing
`fix` modes in lifecycle phases 6 and 8, and docs that never drove the store. All were fixed;
a brace-balance test now guards the GraphQL strings.

Known limits:
- Across-head review-marker dedup skips a repost only when the PR has no threads; with threads it
  reposts, because snapshots carry no thread-resolution timestamps.
- `docs-only` checks that relative link targets stay in the repository, not that the target or
  anchor exists.
- A17 (human end-to-end run) is not done.
