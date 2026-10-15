---
name: pr
description: Runs PR creation, maintenance, and stacked-PR workflows from one command. Use when a branch or pull request needs creation, reconciliation, remediation, publication, merge, or stack management.
argument-hint: "[--info|--monitor|--merge|--ci|--create|--comments|--description|--screenshots|--rebase|--restack|--split|--stack] [PR-URL-or-number] [--auto-merge]"
user-invocable: true
disable-model-invocation: false
---

# PR

## Core Contract

`/pr` is the sole pull-request command. Supply **exactly one** action option below to run that workflow. With no action, run the creation-and-maintenance lifecycle. `--auto-merge` is valid only with no action; reject it with every action option. A supplied PR URL or number is the target; otherwise resolve the current branch consistently through the **Info workflow**.

| Invocation | Workflow |
| --- | --- |
| `/pr` | Default creation-and-maintenance lifecycle |
| `/pr --auto-merge` | Default lifecycle, then merge only after a `clean` monitor result |
| `/pr --info [target]` | Resolve and verify PR metadata (read-only) |
| `/pr --monitor [target]` | Reconcile one PR; default `mode: monitor`, accepts `mode: once` |
| `/pr --merge [target]` | Ready and squash-merge a verified PR without remediation |
| `/pr --ci [target]` | Investigate and fix failed PR CI |
| `/pr --create [target]` | Create one draft PR for the current branch |
| `/pr --comments [target]` | Address unresolved review threads |
| `/pr --description [target]` | Refresh title and body |
| `/pr --screenshots [target]` | Refresh UI evidence attachments |
| `/pr --rebase [target]` | Rebase one PR branch on its PR base |
| `/pr --restack [target]` | Manually realign a dependent branch stack |
| `/pr --split [target]` | Propose, then execute, a split into reviewable PRs |
| `/pr --stack [target]` | Manage GitHub native stacked PRs |

Follow `CLAUDE.md` / `AGENTS.md` on conflict. Default GitHub tool is `gh`.

## Default Lifecycle

1. Run `changes` to resolve comparison scope and record exact base/head refs. If a PR exists, use the **Info workflow** for its base/head.
2. If there is uncommitted work: on `main` or `develop`, create a `branch`, then `commit`; otherwise `commit` it.
3. Run the **Info workflow**. If no PR exists, run the **Create workflow** and use its resulting PR. Stop on every other Info gate.
4. Run the **Monitor workflow** with `mode: once`, or `mode: monitor` with `--auto-merge`.
5. With `--auto-merge`, run the **Merge workflow** only when monitor returns `clean`; otherwise report the blocker and do not merge.
6. Report comparison scope, branch/commit outcomes, PR, monitor result (including final head OID and blocker), and requested merge result.

Stop and ask on failed setup, an inherited stop gate, unexpected branch state, or unexpected working-tree changes. Never continue from uncommitted work on `main`/`develop` without first branching and committing; never merge without `--auto-merge` in this lifecycle.

## Shared PR Resolution (Info workflow)

Resolve exactly one PR, read-only. With a target use `gh pr view <id> --json number,title,body,url,headRefName,headRefOid,baseRefName,baseRefOid,state,isDraft,author,mergeStateStatus`; otherwise use that query for the branch, falling back to `gh pr list --head <branch>` then the same view query. Verify `headRefName` is the current branch. Return all queried fields and fetch `gh api repos/{owner}/{repo}/pulls/{number} --jq '.stack'`; when non-null, report stack number, size, and position.

Stop and ask for no PR, multiple matches, branch mismatch, unexpected closed/merged state, or unexpected repository state. `baseRefOid`/`headRefOid` are authoritative: compare with `git diff <baseRefOid>..<headRefOid>` (and equivalent log/stat), never a guessed local trunk ref. Verify local `HEAD` equals `headRefOid` before presenting a `HEAD` diff; report stale/unpushed checkout otherwise. Keep committed PR changes separate from staged, unstaged, and untracked work. Report resolution method, number/title/URL, head/base/state, stack membership, and gates.

## Create workflow (`--create`)

Create exactly one PR for the current branch against the correct base. Default base is repo convention then `develop`; default state is draft.

1. Run Info; if a PR exists, report it and stop.
2. Confirm the branch is pushed; if needed, `git push -u origin <branch>`.
3. Resolve explicit base > repository convention > `develop`; inspect `git log <base>..HEAD`, `git diff --stat <base>...HEAD`, and `git diff <base>...HEAD` for title and placeholder body.
4. Create with `gh pr create --draft --base <base> --title ... --body ...`.
5. Run the **Description workflow** for the final body, re-read, and report URL.

Stop for no commits ahead, ambiguous base, or push failure. Never create a second PR, force-push/rewrite history, write final body inline, mark ready without explicit request, or continue after unexpected tree changes. Report number/URL, base, draft state, push result, and gates.

## Monitor workflow (`--monitor`)

This is the sole reconciliation engine. It accepts `mode: monitor` (default) or `once`; both run the same cycle on exactly one verified open PR and bind observations to `headRefOid`. It returns `clean` only after a final same-head clean resnapshot; `pending` when another cycle is required (including current-head waiting CI); or `blocked` for inherited gates, non-actionable feedback, external/validation/auth/API problems, ambiguity, unexpected tree state, or no progress. `once` never sleeps; `monitor` sleeps the configured default 60 seconds only after `pending`.

1. Resolve Info and capture entry head, repository, and PR.
2. Snapshot unresolved threads and required CI, surrounding both with Info so only entry-head observations count.
3. For actionable threads, run the **Comments workflow** with push/reply/resolution deferred. For completed failing required checks, run the **CI workflow** with pushes deferred. Stop on their blockers.
4. Batch remediation. Publish exactly once with the **Rebase workflow** only for local remediation or needed base/native-stack synchronization; a native stack uses the **Stack workflow**. Do not make intermediate pushes.
5. Run the **Description workflow** once per relevant head (published head if changed); it includes required screenshot handling. Then run Comments to finalize deferred replies/resolutions only after that head is published.
6. Resnapshot Info, threads, and required CI. Discard observations if head changed outside the single publication. Return `pending` for waiting CI/new head; `blocked` for unchanged non-actionable feedback; otherwise final complete same-head clean resnapshot before `clean`.

Use `gh pr checks <number> --required`; only terminal non-failing required checks are clean. Pending/queued/in-progress are pending; failing/cancelled/timed-out/action-required require CI remediation. Pagination, incomplete data, authentication, rate-limit, or API failure is blocked. Never bypass workflow gates, publish partial remediation, resolve/reply before remediation is published, spin on unchanged evidence, force-push outside Rebase/Stack, or return clean without final same-head confirmation. Report PR, mode, state, final OID, thread/CI snapshot, waits, remediation/publication/description outcomes, and blocker.

## CI workflow (`--ci`)

Resolve Info, read failed completed checks/runs with `gh pr checks` and `gh run view --log`, group failures by root cause, and classify each as real code issue, already fixed, flaky, external, or unclear. Make minimal fixes for real issues; validate touched areas; commit and push only if code changed and validation passed. Report rerun guidance and unresolved flaky/external blockers. Stop before risky architecture/product choices or ambiguous trade-offs. Never rely only on summaries when logs exist, treat duplicates as distinct without evidence, create an empty commit, push failing validation, force-push without request, overwrite unrelated work, or fabricate fixes for flaky/infrastructure failures.

## Comments workflow (`--comments`)

Resolve Info and load unresolved review threads (prefer GraphQL thread state). Triage each: implement, already addressed, explain non-action, or escalate. Apply minimal worthwhile fixes, validate, and commit/push when code changed and validation passes. Only after final branch state, reply in-thread (GraphQL `addPullRequestReviewThreadReply` or targeted `gh pr review --comment --body-file`) and resolve appropriate threads with GraphQL `resolveReviewThread`; never use `gh pr comment` for thread-specific replies. Every reply begins:

```markdown
> [!NOTE]
> 🤖 Written by <owner>'s Agent
```

then a blank line and terse outcome-first text. Obtain owner with `gh api user --jq '.name // .login'`, using first display-name word when needed. Leave blocked threads unresolved. Stop for product/architecture/high-risk trade-offs. Never assume a unique PR, resolve before final branch state, create empty commits, push/resolve after failed validation, force-push without request, overwrite unrelated work, or proceed after unexpected changes. Report fixed, resolved-without-code, explained, commit/push, and blockers.

## Rebase workflow (`--rebase`)

Use Info to capture `baseRefName`, title, body, and stack. If stack is non-null, use the **Stack workflow** (`gh stack rebase`/`sync`); never rebase one native layer in isolation. If no PR exists, ask whether generic `rebase` base detection or an explicit base is wanted. Otherwise use `rebase` pinned to the PR base and `conflicts` for pauses; do not duplicate fetch/rebase/push mechanics. Never run on `develop`/`main`, force-push them, guess missing/ambiguous base metadata, or use `--force` instead of `--force-with-lease`. Report PR, base, completion, conflicts, and push result.

## Restack workflow (`--restack`)

This is the manual fallback. For an enabled native stack or `gh stack` tracking, use the Stack workflow (`sync`/`rebase`) instead.

1. Gather order/top branch, upstream changes, and merge style; fetch/map PR metadata; fast-forward root base to `origin/<root-base>`.
2. Detect drift and build a per-branch plan with current/new base, retained/dropped commits, risks, and lease SHA. Present it and wait for explicit approval.
3. Create backup refs. Bottom-up: reset/checkout each branch to `origin/<branch>`, use `rebase` (transplant where needed, `push=false`) and `conflicts`, refresh lockfile if manifests changed, typecheck, range-diff/log against plan, then strict lease force-push.
4. Update changed PR bases and report each result.

Never execute before approval, use plain force, rewrite without backups, continue over ambiguity/non-trivial conflict/unexpected drops, or advance after validation failure. Report root base, approval, each base/SHA transition, pushes, PR bases, backups, and risks.

## Description workflow (`--description`)

Resolve Info; when none exists, stop and suggest `--create`. Read title/body. Apply already-supplied repository instructions without searching for more; inspect only standard root/`.github`/`docs` case-insensitive `pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, and relevant `CONTRIBUTING*`. Select template by existing body/change type; stop only when materially different choices are ambiguous. Precedence: applicable instructions, selected template, still-relevant existing content, then default template.

Analyze the authoritative base/head diff, stat, and log; identify title/body/checklist drift. If UI changed, run **Screenshots workflow** before final body, preserving its attachment-bearing edit. Draft terse BLUF content: state what changed, not rationale; under applicable ceiling (trivial 50, single 150, multi 300, breaking 400 words); sentences/bullets about 25 words; group by cohesive behavior/area, never file/commit/order; preserve links, relevant attachments, required fields/template comments; include specific Testing and only useful Notes. Default only when repository guidance leaves gaps:

```markdown
## Summary
<1–2 sentence BLUF>

## Changes
### <group>
- <one-clause fact>

## Testing
<specific verification>

## Notes (optional)
```

Self-review once, update title only if genuinely drifted, update body, and re-read. `gh pr edit --body-file` fallback for deprecated `projectCards` is text-only REST PATCH `repos/<owner>/<repo>/pulls/<number>`; it cannot carry media attachments. Never read title/body late, infer solely from commit messages, remove relevant links/attachments, drop required content, check unsupported checklist items, keep stale description/evidence, commit media, or overwrite unrelated work. Report PR/base, guidance/template, title old→new or unchanged, drift, and sections rewritten/preserved/removed.

## Screenshots workflow (`--screenshots`)

Resolve Info, use authoritative diff/stat, and decide applicability. UI includes components/views/templates/styles/pages/UI directories and `tsx/jsx/vue/svelte/css/scss`; backend/config/docs/tests/tooling/nonvisual refactors are not applicable. If not applicable, report “no UI change — screenshots not required” and stop. Inventory body images, `user-images.githubusercontent.com`/`github.com/user-attachments` URLs, and screenshot details blocks. Classify missing, stale (older than/superseded by UI commits), or current. Current evidence stops without recapture.

For missing/stale evidence require reachable final-HEAD site; build an evidence matrix linking PR capabilities to final-state screenshot/video moments. Use before/after only for explicit replacement/regression, label exact refs, keep viewport/theme/device consistent, and use Before–After–Bridge narration. Delegate capture to `visual-capture` (and a base worktree where needed), never ad-hoc tooling. Assets are untracked `captures/` output; never repository files.

Before attaching, require: `gh` >=2.99.0, `gh auth status`, `ADMIN`/`MAINTAIN`/`WRITE` viewer permission, `https://github.com` host, and no more than 50 files. Failed preflight means pending handoff only: artifact paths plus paste-ready `## Screenshots` Markdown; user may drag/drop manually, and no `--attach` attempt occurs. For upload use a private temp dir with cleanup, serialize current body via `gh pr view <number> --json body | jq -j '.body' > "$BODY_FILE"`, edit only the exact managed Screenshots section (preserve every other byte), validate supported image/video MIME and <=10 MiB, and ensure every absolute local path appears exactly once with alt text. Run exactly one `gh pr edit <number> --body-file "$BODY_FILE" --attach <path> ...`, then always re-read body—even on nonzero—to inventory hosted URLs and remaining local paths. Never retry after nonzero; partial uploads may have succeeded. A zero exit requires every path rewritten to hosted URLs. Private-repo anonymous 404/403 is expected.
Allowed MIME types are `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `video/mp4`, `video/quicktime`, and `video/webm`; use `file --brief --mime-type` and `wc -c`, re-encode/shrink with `visual-capture` guidance, or stop. A nonzero attachment edit may still update successful files, so report its exact partial state and stop; private-repo anonymous attachment 404/403 is expected.

Stop for unsupported CLI/auth/access/host/count, unreachable site, ambiguous refs, unavailable capture tooling, unsupported/oversize asset, or artifacts in repository. Never capture blank/error pages, recapture current evidence, commit/force-push artifacts, attach unreferenced or duplicate paths, overwrite unrelated body content, or claim fabricated URLs. Report applicability, inventory/classification, matrix/media/surfaces/refs, command status, hosted and remaining paths, native success or pending handoff, no-commit confirmation, and body sections updated.

## Merge workflow (`--merge`)

Merge one verified open PR by squash, using title plus ` (#<number>)` as subject and empty body. This workflow never remediates CI or review feedback.

1. Resolve Info, record number/title/draft/head OID; stop on its gates and ask if it is a native stack layer.
2. Ready a draft (`gh pr ready <number>`); snapshot `gh pr checks <number> --required` and unresolved GraphQL review threads (stop on pagination/query failure). Any failing, cancelled, timed-out, action-required, queued, pending, in-progress check or unresolved thread stops.
3. Re-run Info and stop on head change. Squash merge with `gh pr merge <number> --squash --subject "<title> (#<number>)" --body ""`; preserve an existing exact suffix only once. Confirm `state=MERGED` and non-null `mergedAt`; queued/scheduled is not confirmed.
4. Only after confirmed merge: primary checkout requires clean tree then `git comp`, or `git checkout <default> && git pull --ff-only`; report new HEAD then send this terminal `/clear` (Claude) or `/new` (Codex/Pi), using resolved Orca CLI and `ORCA terminal send` when available. Linked Orca worktree: resolve CLI once, load `orca-cli` guide, require successful `ORCA worktree current --json` with `ok:true` and non-main cwd, report imminent removal, then final command exactly `ORCA worktree rm --worktree active --force --json`; silently skip unavailable/nonmatching Orca. Never clean up after failed/skipped/already-merged start.

Never merge ambiguous/closed/mismatched PRs, retry/fix CI, reply/resolve threads, edit title/body, use non-squash/nonempty body, explicitly delete head branch, force-push/change local state except post-merge path, treat stale/waiting CI as passing, remove primary checkout, or remove worktree without this confirmed merge and active Orca detection. Report verified PR, draft conversion, CI/thread snapshot, OID, subject, post-merge path, blocker.

## Split workflow (`--split`)

Use `changes` (with Info/scope resolution) to group the branch/PR, read intent/log/metadata, map dependencies, and classify groups orthogonal or dependent. Propose parallel PRs from base for orthogonal groups and bottom-to-top stacks only for dependencies; include units, hunks/files, bases, order, rationale, size concerns. Stop for explicit approval before any rewrite. On approval, create branches, move changes, commit; run **Create workflow** for parallel branches, and for stacked work probe/use **Stack workflow** (`init`/`submit`/`link`) when available or Create plus Restack fallback otherwise. Verify each intended base and report PR set. Never rewrite/create/move before approval; split dependencies into parallel work; drop/duplicate a hunk; target wrong base; delegate dependency analysis; or disclose secrets. Stop for ambiguous dependencies, unclean separation, or rewritten reviewed history.

## Stack workflow (`--stack`)

Manage one GitHub native stack: create, add, publish, sync/restack, link, inspect, checkout, collapse, or dissolve. Always probe first and report tier: extension `gh extension list` containing `github/gh-stack`; feature `gh api repos/{owner}/{repo}/stacks` (404/no CLI exit 9 means unavailable). Cache per session. A custom SSH host alias requires explicit `--repo <owner>/<repo>` REST paths because auto-detection is wrong. T1 extension+feature permits full CLI; T2 feature-only permits REST read/link/extend/dissolve and manual Restack; T3 reports evidence and uses Restack/rebase fallback. Run noninteractively; TUI/prompt commands are gates.

At T1 set `git config rerere.enabled true` and, with multiple remotes, `git config remote.pushDefault origin`. Always use explicit arguments: never bare `view`/`view --short` (use `view --json`), bare `init`/`add`/`checkout`, submit without `--auto`, `switch`, or `modify`. Map operations: init explicit branches/base; add from top with name; publish `submit --auto` (draft) or `--auto --open`; sync (only `--prune` after approval), resolving via `conflicts` then `gh stack rebase --continue`; TUI restructure requires user driving it or approved `unstack --local`, explicit init, submit; link T1 CLI or T2 first chain PR bases bottom-up then `POST .../stacks` (2–100), extend with `/add`; inspect with T1 JSON or T2 REST; checkout explicit identifier (unstack first for unbypassable composition prompt); navigation explicit `up/down/top/bottom/trunk`.

For collapse, confirm survivor/close/squash policy. Default survivor top, preserve commits, verify every lower head is ancestor, dissolve, repoint survivor to trunk, close lower PRs with fold-in comment while retaining branches, and refresh survivor description. Dissolve/unstack needs explicit confirmation; report retained merged/merging/queued PRs. For mid-stack feedback, fix on owning layer, cascade `rebase --upstack`/full rebase, then atomic lease push; never patch lower concern into higher layer. Native stack merges are web UI only, atomically include every unmerged lower layer; warn/confirm intended merge point and provide URL instead of CLI merge. After mutation inspect and report per branch/PR.

Stop and ask on local/remote divergence, multi-stack branch (exit 6), lock (8), rebase in progress (7), dirty tree before rebase/restructure, or fully merged stack about to spawn a new submit stack. Never fake T3 behavior, auto-resolve divergence, use plain force, drive TUI, unstack/dissolve without confirmation, delete local branches without approval, create T2 stack before correct chaining, or resolve conflicts inline. Report tier/evidence, operation, outcomes, stack number/URL, conflicts, fallback, and follow-ups.
