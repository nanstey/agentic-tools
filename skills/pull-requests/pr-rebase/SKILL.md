---
name: pr-rebase
description: Rebases the current branch onto the latest PR base branch from GitHub metadata, resolves merge conflicts using branch purpose and the related PR description when available, then force-pushes with lease to origin. Use when the user wants to rebase a feature branch onto its actual PR target branch, sync before merge, or update PR history after resolving conflicts.
disable-model-invocation: true
---

# PR rebase (base-aware)

The **PR-aware, base-aware** variant of the general `rebase` skill. It delegates all
rebase mechanics — fetch, rebase, conflict handoff, force-push-with-lease — to `rebase`,
and adds only two things on top:

1. **Pin the base** to the PR's actual base branch from GitHub metadata, instead of assuming `main` or `develop`.
2. **Load PR context** so conflict resolution is anchored to what the PR says the branch should accomplish.

CLAUDE.md / AGENTS.md win if anything here conflicts.

## Steps

### 1. Load PR context (the value this skill adds)

Use the **`pr-info`** skill to resolve the PR for the current branch and load its title/body —
invoke it via the Skill tool where supported, otherwise follow its workflow. Treat the PR
title/body as the authority for *what this branch should accomplish* when resolving conflicts.
Also read the PR base branch (`baseRefName` / base branch) from that same PR metadata; this
is the authoritative rebase target.

If `pr-info` reports no PR, stop and ask whether to:

- delegate to the general `rebase` skill's base detection, or
- explicitly use a user-provided base branch.

In the no-PR path, fall back to branch intent (`git log origin/<base>..HEAD --oneline`) and
the user-stated goal. The downstream `conflicts` skill re-reads PR context when available, so
it is carried through automatically.

### 2. Delegate to the `rebase` skill

Invoke the **`rebase`** skill via the Skill tool (or follow its workflow where skill
invocation is unavailable), with the base pinned to **the PR base branch** from Step 1. It will:

- guard against running on a protected base and require a clean working tree,
- `git fetch origin <pr-base>` and `git rebase origin/<pr-base>`,
- hand any conflicts to the **`conflicts`** skill (which resolves by PR/branch intent), and
- `git push --force-with-lease` on the current feature branch only after a clean rebase.

Do not re-implement fetch, rebase, conflict resolution, or push here — that logic lives in
`rebase` and `conflicts`. This skill only ensures the base matches the PR and the PR context is loaded.

## Guards

- Do not run on `develop` or `main`; never force-push them. (`rebase` enforces this too.)
- Prefer `--force-with-lease` over `--force` so a mismatched remote aborts.
- If PR base metadata is missing or ambiguous, stop and ask instead of guessing.

## Quick checklist

- [ ] PR context loaded via `pr-info` (or branch intent established when no PR)
- [ ] PR base branch captured from metadata and used as rebase target
- [ ] Delegated to `rebase` with base pinned to the PR base
- [ ] Conflicts handled by `conflicts` using PR/branch intent
- [ ] Force-pushed with lease on the current branch only
