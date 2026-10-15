# GH Stack

## Core Contract

Drive GitHub's native stacked-PR tooling for one repository: create, grow, publish, sync, link, inspect, and dissolve stacks.
Stacked PRs are not widely enabled; always probe capability first and state the active tier before acting.
Run every operation non-interactively; interactive TUIs are blocked.
Delegate conflict resolution to `conflicts`, single-branch rebase mechanics to `rebase`, and manual stack restacking to `/pr restack`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Command and API details load on demand:

- `references/cli.md` — `gh stack` commands, flags, exit codes.
- `references/rest-api.md` — Stacks REST endpoints and the PR `stack` object.
- `references/workflows.md` — merge semantics, day-to-day recipes (mid-stack changes, review feedback, adopting branches), stack structuring guidance.

## Required Inputs

1. Operation: create, add layer, submit/publish, sync/restack, link, inspect, checkout, collapse, dissolve.
2. Repo (`owner/repo`, default current) and remote (default auto-detected).
3. Branch order (bottom→top) or PR numbers, as the operation requires.
4. Trunk override (`--base`), if not the default branch.
5. Draft vs ready-for-review intent for new PRs (default draft).

## Capability Tiers

Probe before the first operation, cache the result for the session:

1. Extension: `gh extension list` contains `github/gh-stack`.
2. Feature: `gh api repos/{owner}/{repo}/stacks` — HTTP 404 means Stacked PRs are not enabled for the repo (CLI equivalent: exit code 9).

A custom SSH remote host alias (e.g. `github.com-work`) breaks `gh stack`/`gh` repo auto-detection: the derived `owner/repo` will be wrong or empty. When the remote uses a host alias, drive the REST API path with explicit `--repo <owner>/<repo>` (or `gh api` with an explicit owner/repo) rather than relying on auto-detection.

| Tier | Condition | Capability |
| --- | --- | --- |
| T1 | extension + feature | Full `gh stack` CLI |
| T2 | feature only | Read/link/extend/dissolve via `gh api`; rebasing via `/pr restack` |
| T3 | no feature | Report probe evidence; fall back to `/pr restack` / `rebase` |

## Workflow

1. Probe tiers; report the active tier and evidence. At T1, run the prompt-avoidance preflight once: `git config rerere.enabled true`; on multi-remote repos also `git config remote.pushDefault origin` (see `references/cli.md`).
2. Map the requested operation to the tier:
   - **Create (T1)**: `gh stack init [--base <trunk>] <branches...>` — always pass explicit branch names; adopts existing branches, creates missing ones.
   - **Add layer (T1)**: from the top branch, `gh stack add <name>` (optionally `-Am "<msg>"` / `-um "<msg>"` to commit first).
   - **Publish (T1)**: `gh stack submit --auto` (drafts) or `--auto --open` (ready). Never open the interactive submit editor.
   - **Sync (T1)**: `gh stack sync` (add `--prune` only when the invocation requests pruning). On cascade conflict: `gh stack rebase`, delegate resolution to `conflicts`, then `gh stack rebase --continue`. `--abort` only when the invocation requests it.
   - **Restructure (T1)**: `gh stack modify` is TUI-only — always run option (b), never the TUI: `gh stack unstack --local` + `gh stack init <new-order...>` + `gh stack submit`.
   - **Link (T1/T2)**: T1 `gh stack link [--base <trunk>] <branches-or-prs...>`; T2 requires properly chained PRs first (each PR's base = previous PR's head) — if not already chained, update bases via `gh api .../pulls/{n} -X PATCH -f base=<parent-branch>` bottom-up, then `POST /repos/{o}/{r}/stacks` with ordered PR numbers bottom→top (min 2). Extend with `POST .../stacks/{n}/add`.
   - **Inspect (T1/T2)**: T1 `gh stack view --json` — never bare or `--short` (both are TUIs); T2 `GET .../stacks` or per-PR `gh api .../pulls/{n} --jq '.stack'`.
   - **Checkout (T1)**: `gh stack checkout <number|url|branch>` with an explicit argument; if local and remote stack compositions differ this prompts unbypassably — `gh stack unstack` first. Navigation via `gh stack up|down|top|bottom|trunk`.
   - **Collapse (T1/T2)**: fold the whole stack into a single PR. Run only when the invocation names collapsing, using the defaults in the 5-step recipe below (survivor = top PR, leave lower branches intact, preserve commits) unless the invocation overrides them. **T1**: prefer `gh stack unstack <n>` to dissolve, then re-point the survivor base and close lower PRs via CLI/API. **T2 / host-alias fallback**: `POST /repos/{o}/{r}/stacks/{n}/unstack`, `PATCH /repos/{o}/{r}/pulls/{survivor}` with `base=<trunk>`, then per lower PR `PATCH /repos/{o}/{r}/pulls/{lower}` with `state=closed` plus a fold-in comment referencing the survivor. See `references/workflows.md` for the exact sequences.
     Default collapse policy:
     1. **Survivor = top PR** — it already contains every commit in the stack, so re-pointing it to trunk is lossless. Verify with `git merge-base --is-ancestor <lower-head> <survivor-head>` for each lower head before acting; stop as blocked if any lower branch is not an ancestor (diverged/non-linear stack).
     2. **Preserve commits** — do not squash by default (keeps authored history); offer squash only on explicit request.
     3. **Re-point** the survivor's base to trunk (`--base`, default the stack's trunk).
     4. **Close lower PRs** with a fold-in comment referencing the survivor; leave their branches intact (non-destructive).
     5. **Refresh** the survivor's title/body to describe the full changeset, since the top PR's title usually covers only its own layer.
   - **Dissolve (T1/T2)**: run only when the invocation names dissolving, then `gh stack unstack [<n>] [--local]` or `POST .../stacks/{n}/unstack`. Report PRs left stacked (merged/merging/queued cannot be removed).
   - **Any (T3)**: report why native stacks are unavailable; hand the task to `/pr restack` (stack) or `rebase` (single branch).
3. For mid-stack fixes and review feedback, follow the recipes in `references/workflows.md`: commit on the layer that owns the change, `gh stack rebase --upstack` (or full `rebase`), then `gh stack push` — never patch a lower-layer concern into a higher branch.
4. After mutating operations, verify with an inspect call and report per-branch/PR outcomes.

Stop as blocked when: local and remote stack compositions diverge; a branch belongs to multiple stacks (exit 6); the stack is locked (exit 8); a rebase is already in progress (exit 7); the working tree is dirty before rebase/restructure; or a fully merged stack would silently spawn a new one on submit.

## Safety Rules

- Never act before probing capability; never fake stack behaviour at T3.
- Never drive interactive TUIs (`modify`, submit editor, checkout/switch pickers); use flags and explicit arguments, or stop as blocked.
- Never use plain `--force`; stack pushes rely on `--force-with-lease` (built into `push`/`sync`).
- Never dissolve or unstack on GitHub unless the invocation names it.
- Collapse is destructive (dissolves the stack + closes PRs) — apply the defaults or the invocation's overrides; verify the survivor is a descendant of every lower head (`git merge-base --is-ancestor`) before re-pointing.
- Never auto-resolve stack divergence; stop as blocked and report the options.
- Never rebase or restructure over a dirty working tree; stop as blocked and report the dirty files.
- Never resolve conflicts inline; delegate to `conflicts`.
- Never delete local branches (`--prune`) unless the invocation requests pruning.
- Never create a T2 stack without verifying/fixing PR bases first; each PR's base must be the previous PR's head, not trunk.
- Never merge a stacked PR without stating in the output that it atomically merges every unmerged PR below it; the PR named in the invocation is the intended merge point. Merging stacked PRs is web-UI only — hand the user the PR URL rather than attempting `gh pr merge`.

## Output Style

Report active tier with probe evidence, operation performed, per-branch/PR outcome (created/pushed/linked/rebased/skipped), stack number and URL when known, conflict handling status, any fallback taken, and open follow-ups.
