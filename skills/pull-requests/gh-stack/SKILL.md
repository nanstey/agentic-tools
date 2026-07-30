---
name: gh-stack
description: Creates and manages GitHub native stacked-PR stacks via the gh-stack CLI or Stacks REST API, with fallback when the feature is unavailable. Use when creating, linking, syncing, inspecting, or dissolving a stack of dependent branches/PRs.
user-invocable: true
disable-model-invocation: false
---

# GH Stack

## Core Contract

Drive GitHub's native stacked-PR tooling for one repository: create, grow, publish, sync, link, inspect, and dissolve stacks.
Stacked PRs are not widely enabled; always probe capability first and state the active tier before acting.
Run every operation non-interactively; interactive TUIs are stop-and-ask gates.
Delegate conflict resolution to `conflicts`, single-branch rebase mechanics to `rebase`, and manual stack restacking to `pr-restack`.
Follow `CLAUDE.md` / `AGENTS.md` on conflict.

Command and API details load on demand:

- `references/cli.md` — `gh stack` commands, flags, exit codes.
- `references/rest-api.md` — Stacks REST endpoints and the PR `stack` object.
- `references/workflows.md` — merge semantics, day-to-day recipes (mid-stack changes, review feedback, adopting branches), stack structuring guidance.

## Required Inputs

1. Operation: create, add layer, submit/publish, sync/restack, link, inspect, checkout, dissolve.
2. Repo (`owner/repo`, default current) and remote (default auto-detected).
3. Branch order (bottom→top) or PR numbers, as the operation requires.
4. Trunk override (`--base`), if not the default branch.
5. Draft vs ready-for-review intent for new PRs (default draft).

## Capability Tiers

Probe before the first operation, cache the result for the session:

1. Extension: `gh extension list` contains `github/gh-stack`.
2. Feature: `gh api repos/{owner}/{repo}/stacks` — HTTP 404 means Stacked PRs are not enabled for the repo (CLI equivalent: exit code 9).

| Tier | Condition | Capability |
| --- | --- | --- |
| T1 | extension + feature | Full `gh stack` CLI |
| T2 | feature only | Read/link/extend/dissolve via `gh api`; rebasing via `pr-restack` |
| T3 | no feature | Report probe evidence; fall back to `pr-restack` / `rebase` |

## Workflow

1. Probe tiers; report the active tier and evidence. At T1, run the prompt-avoidance preflight once: `git config rerere.enabled true`; on multi-remote repos also `git config remote.pushDefault origin` (see `references/cli.md`).
2. Map the requested operation to the tier:
   - **Create (T1)**: `gh stack init [--base <trunk>] <branches...>` — always pass explicit branch names; adopts existing branches, creates missing ones.
   - **Add layer (T1)**: from the top branch, `gh stack add <name>` (optionally `-Am "<msg>"` / `-um "<msg>"` to commit first).
   - **Publish (T1)**: `gh stack submit --auto` (drafts) or `--auto --open` (ready). Never open the interactive submit editor.
   - **Sync (T1)**: `gh stack sync` (add `--prune` only with user approval to delete merged local branches). On cascade conflict: `gh stack rebase`, delegate resolution to `conflicts`, then `gh stack rebase --continue`. `--abort` only on user request.
   - **Restructure (T1)**: `gh stack modify` is TUI-only — stop and ask: (a) user drives the TUI, or (b) skill runs `gh stack unstack --local` + `gh stack init <new-order...>` + `gh stack submit`.
   - **Link (T1/T2)**: T1 `gh stack link [--base <trunk>] <branches-or-prs...>`; T2 requires properly chained PRs first (each PR's base = previous PR's head) — if not already chained, update bases via `gh api .../pulls/{n} -X PATCH -f base=<parent-branch>` bottom-up, then `POST /repos/{o}/{r}/stacks` with ordered PR numbers bottom→top (min 2). Extend with `POST .../stacks/{n}/add`.
   - **Inspect (T1/T2)**: T1 `gh stack view --json` — never bare or `--short` (both are TUIs); T2 `GET .../stacks` or per-PR `gh api .../pulls/{n} --jq '.stack'`.
   - **Checkout (T1)**: `gh stack checkout <number|url|branch>` with an explicit argument; if local and remote stack compositions differ this prompts unbypassably — `gh stack unstack` first. Navigation via `gh stack up|down|top|bottom|trunk`.
   - **Dissolve (T1/T2)**: confirm with the user first, then `gh stack unstack [<n>] [--local]` or `POST .../stacks/{n}/unstack`. Report PRs left stacked (merged/merging/queued cannot be removed).
   - **Any (T3)**: report why native stacks are unavailable; hand the task to `pr-restack` (stack) or `rebase` (single branch).
3. For mid-stack fixes and review feedback, follow the recipes in `references/workflows.md`: commit on the layer that owns the change, `gh stack rebase --upstack` (or full `rebase`), then `gh stack push` — never patch a lower-layer concern into a higher branch.
4. After mutating operations, verify with an inspect call and report per-branch/PR outcomes.

Stop and ask when: local and remote stack compositions diverge; a branch belongs to multiple stacks (exit 6); the stack is locked (exit 8); a rebase is already in progress (exit 7); the working tree is dirty before rebase/restructure; or a fully merged stack would silently spawn a new one on submit.

## Safety Rules

- Never act before probing capability; never fake stack behaviour at T3.
- Never drive interactive TUIs (`modify`, submit editor, checkout/switch pickers); use flags and explicit arguments, or stop and ask.
- Never use plain `--force`; stack pushes rely on `--force-with-lease` (built into `push`/`sync`).
- Never dissolve or unstack on GitHub without explicit user confirmation.
- Never auto-resolve stack divergence; present the options and wait.
- Never rebase or restructure over a dirty working tree; ask to commit or stash first.
- Never resolve conflicts inline; delegate to `conflicts`.
- Never delete local branches (`--prune`) without user approval.
- Never create a T2 stack without verifying/fixing PR bases first; each PR's base must be the previous PR's head, not trunk.
- Never merge a stacked PR without warning that it atomically merges every unmerged PR below it; confirm the intended merge point first. Merging stacked PRs is web-UI only — hand the user the PR URL rather than attempting `gh pr merge`.

## Output Style

Report active tier with probe evidence, operation performed, per-branch/PR outcome (created/pushed/linked/rebased/skipped), stack number and URL when known, conflict handling status, any fallback taken, and open follow-ups.
