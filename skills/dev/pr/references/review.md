# PR Review

## Core Contract

Review one PR with 3 parallel perspective reviewers and 1 synthesizer, then present one deduplicated, severity-ranked report in chat.
Works on your own PRs and other people's PRs. Read-only unless `fix` (own PR) or `comment` (others' PR) is passed.
Invocation: `/pr review [target] [fix|comment]`. Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Write all prose using `terse`.

Never ask the user anything; apply the non-interactive policy in `SKILL.md`.

## Inputs

1. `target`: PR URL/number; otherwise current branch (resolved per `/pr info`).
2. Optional mode word: `fix` or `comment`.
3. Viewer: `gh api user --jq .login`.

## Workflow

### 1. Resolve and classify

1. Resolve the PR with `/pr info` semantics (same `gh pr view --json ...` query, stack lookup, state checks).
   - Review is read-only, so a `headRefName` ≠ current branch is **not** a blocker; record it as informational.
   - Still stop as `blocked` on no PR, multiple matches, or closed/merged PR.
2. Classify: `own` if `author.login` equals the viewer login, else `other`.
3. Validate the mode word: `fix` requires `own`; `comment` requires `other`. A mismatch stops as `blocked` (say which mode applies). Both words, or any other word, is rejected.

### 2. Obtain the code read-only

Diff is always `git diff <baseRefOid>..<headRefOid>` (see `info.md` "Authoritative diff comparison"); never a local base ref.

1. Fetch the objects without touching the working tree or current branch:
   `git fetch origin pull/<number>/head` (covers forks), plus `git fetch origin <baseRefOid>` if the base commit is missing.
2. If current `HEAD` equals `headRefOid`, review in place. Otherwise create a detached throwaway worktree:
   `git worktree add --detach "$(mktemp -d)" <headRefOid>`. Reviewers read from it. Remove it with `git worktree remove --force <path>` when done, including on failure.
3. Never checkout, reset, stash, or otherwise change the user's current branch or working tree for review. Ignore uncommitted local changes; they are not part of the PR.
4. Gather shared context once: `git diff --stat` and full diff for `<baseRefOid>..<headRefOid>`, PR title/body, repo instructions (`CLAUDE.md` / `AGENTS.md`, `CONTRIBUTING*`, PR template), and existing review threads (`gh pr view --comments`, GraphQL `reviewThreads`) so reviewers skip already-raised points.

### 3. Spawn 3 reviewers in parallel

Spawn all three in a single `subagent` batch, each `agent: "reviewer"` with its perspective in the task (no per-perspective profiles exist), and read-only tools (no edit/write, no `gh` mutations, no git state changes). Each receives the shared context and its template below. Wait for all three; a failed or empty reviewer is reported as a gap, not retried more than once.

| Perspective | Focus |
| --- | --- |
| correctness | Bugs, logic errors, edge cases, error handling, concurrency, regressions, API/contract breaks |
| design | Architecture, boundaries, naming, duplication, maintainability, repo conventions, docs |
| risk | Security, tests and coverage gaps, performance, data/migration/operational risk, dependency changes |

### 4. Spawn the synthesizer

After all three return, spawn one `subagent` (read-only) with the three raw finding sets and the synthesizer template. It returns the final report to the orchestrator. The orchestrator verifies a sample of `high`/`blocker` findings against the diff (file:line exists in `<baseRefOid>..<headRefOid>`, evidence matches) and drops or downgrades any it cannot confirm.

### 5. Present

Print the report in chat (format below), then the next step for the PR class. Nothing is posted, committed, or pushed without the mode word.

## Subagent Prompt Templates

Common preamble for all reviewers (fill `{…}`):

```text
You are a read-only code reviewer. Do not modify files, git state, or the PR.
PR: #{number} {title} ({url}); base {baseRefOid} .. head {headRefOid}.
Code is available at {path}. Diff: `git diff {baseRefOid}..{headRefOid}` (run in {path}).
Repo instructions: {summary of CLAUDE.md/AGENTS.md/CONTRIBUTING}.
Already-raised review threads (do not repeat): {list}.
Review only lines changed by the PR, plus code they directly affect. Read surrounding
code to confirm each finding before reporting. No style nits that a formatter/linter
enforces. No speculation: every finding needs concrete evidence.
Perspective: {perspective}.
Return findings only, in this exact format, one block per finding, or `NONE`:

- title: <short>
  severity: blocker|high|medium|low|nit
  confidence: high|medium|low
  location: <path>:<line> (or <path>:<start>-<end>; head-side line numbers)
  evidence: <what in the code shows the problem; quote minimal snippet>
  fix: <concrete suggested change>
  comment: <1-3 sentence review comment addressed to the author, terse, non-accusatory>
```

Perspective lines:

- correctness: "Correctness: bugs, logic errors, off-by-one, null/empty/boundary inputs, error paths, race conditions, resource leaks, behavior regressions, broken callers/contracts."
- design: "Design: architecture and module boundaries, abstraction fit, duplication, naming, complexity, consistency with existing patterns and repo instructions, public API shape, missing/stale docs."
- risk: "Risk: security (injection, authn/authz, secrets, unsafe input), missing or weak tests for changed behavior, performance (hot paths, N+1, unbounded work), migration/rollback/config/operational risk, dependency changes."

Synthesizer prompt:

```text
You are a read-only review synthesizer. Input: three reviewers' findings (correctness,
design, risk) for PR #{number}. Do not modify anything.
1. Merge duplicates and overlapping findings (same root cause or same location); keep
   the strongest evidence and the highest justified severity; note contributing perspectives.
2. Drop findings with weak evidence, low confidence and low severity, or that restate
   already-raised threads. Do not invent new findings.
3. Verify each kept finding's location exists in the diff {baseRefOid}..{headRefOid};
   set `inline: yes|no` (yes only if the line is in a changed hunk on the head side).
4. Rank by severity (blocker > high > medium > low > nit), then confidence, then path.
5. Assign sequential ids F1, F2, … in rank order.
6. Return the report in the required format below, plus a 1-2 sentence overall assessment.
```

## Report Format

```markdown
## Review: #<number> <title> (<own|other>, <url>)
Range: <baseRefOid short>..<headRefOid short> · Files: <n> · Findings: <n> (blocker <n>, high <n>, medium <n>, low <n>, nit <n>)
Assessment: <1-2 sentences>
Gaps: <failed/empty reviewers or unreadable areas, else omit>

1. **F1 · blocker** · `path/file.ext:42` · <title> · from: correctness, risk · inline: yes
   - Evidence: <…>
   - Fix: <…>            <!-- own PR -->
   - Comment: <…>        <!-- others' PR -->
```

Own PR shows `Fix`; others' PR shows `Comment` (the review-comment text to post). Findings are numbered so a follow-up can reference them (e.g. "apply 1,3").

## Own PR

Present the numbered recommended-fix list. State the next step: re-run `/pr review <target> fix` to apply, or apply the set manually in a follow-up.

With `fix`:

1. Require current branch = `headRefName` and `HEAD` = `headRefOid` and a clean working tree; otherwise `blocked` (report the exact checkout/sync command). If the PR is from a fork or the branch is not pushable, `blocked`.
2. Apply fixes for findings of severity `nit`..`blocker` that are concrete and local. Treat findings implying product/architecture decisions or high-risk trade-offs as `blocked`: list them as not applied.
3. Minimal scope: one fix per finding, no unrelated edits or refactors.
4. Validate touched areas (repo's tests/lint/typecheck). On failure: do not commit or push; report.
5. Commit (one commit per logical group; message references finding ids) and push, following the `comments.md` safety rules (no empty commits, no force-push, never overwrite unrelated changes, stop as `blocked` on unexpected changes).
6. `/pr` lifecycle invokes this mode by default on its own PR, once per head (see `lifecycle.md`).
7. Do not reply to or resolve threads; this is not a thread workflow (use `/pr comments` for that).

## Others' PR

Present the numbered recommended-comment list. State the next step: re-run `/pr review <target> comment` to post, or post/adapt manually (`/pr comments` handles only threads on your own branch and does not apply here).

With `comment` (posting mode, separate from `comments.md` thread handling; never touches code, branches, or other reviewers' threads):

1. Re-read `headRefOid`; if it changed since the review, `blocked` and report (rerun review).
2. Build one review: findings with `inline: yes` become inline comments (`path`, `line`, `side: RIGHT`, `body`); `inline: no` go in the review body as a numbered list. Severity prefix per comment (e.g. `**high:**`).
3. Every comment body and the review body start with the disclosure block from `comments.md` step 7 (owner from `gh api user --jq '.name // .login'`, first name only for multi-word names), a blank line, then terse text. Review body also gives the 1-2 sentence assessment.
4. Post once as a single review:
   `gh api repos/{owner}/{repo}/pulls/{number}/reviews --method POST --input <json>` with `commit_id: <headRefOid>`, `event: "COMMENT"`, `body`, `comments: [...]`.
   If GitHub rejects an inline position, move that finding to the body and retry once.
5. Never use `APPROVE` or `REQUEST_CHANGES` unless the invocation explicitly names it (e.g. "approve" / "request changes" in the user's request); otherwise `COMMENT` only. Do not resolve threads.
6. Never post `nit`/`low` findings with `confidence: low`. Never post a finding the orchestrator could not verify against the diff.
7. Report the review URL (`html_url`) and which findings were inline vs body.

## Safety Rules

- Read-only without `fix`/`comment`: no edits, commits, pushes, posts, or thread changes.
- Never change the user's current branch/working tree for review; use fetch plus a detached throwaway worktree, and clean it up.
- Never present a local diff as the PR diff; always use `<baseRefOid>..<headRefOid>`.
- Subagents get read-only tools and never mutate repo or PR; only the orchestrator applies `fix` / `comment`.
- Never post secrets or file contents beyond minimal evidence snippets.
- Never approve or request changes without explicit naming.
- If unexpected repository or PR state appears, stop as `blocked` and report it.

## Output Style

Chat output is the report plus the next step. After a mode run, add: mode, findings applied/posted vs skipped (with reason), validation result, commit/push status or review URL, and blockers.
