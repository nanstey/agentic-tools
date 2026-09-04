---
name: orca-repo
description: Registers an existing local git repository with the Orca IDE and verifies it is tracked, optionally setting its base ref. Use when a local repository should appear in Orca.
user-invocable: true
disable-model-invocation: false
---

# Orca Repo

## Core Contract

Register one existing local git repository with the running Orca IDE via the
`orca` CLI, verify Orca tracks it, and optionally set its base ref. This skill
does not create the repository, its GitHub remote, or any worktree; `new-app`
scaffolds locally and `new-repo` owns GitHub.

Follow the `orca-cli` skill for executable resolution and the version-matched
command guide; `ORCA` below is the resolved executable, never a literal.

## Required Inputs

1. Absolute path of the local repository (must contain a git repository).
2. Optional: base ref (for example `origin/main`); default is Orca's own
   default.

## Workflow

1. Resolve the Orca executable per the `orca-cli` skill (`ORCA_CLI_COMMAND`,
   else `orca-dev`/`orca-ide`/`orca`; never bare `orca` on Linux outside an
   Orca-managed terminal). If it cannot run, report the exact error and stop.
2. Confirm the app is up and the path is a git repository:
   ```sh
   ORCA status --json
   git -C "$REPO_PATH" rev-parse --show-toplevel
   ```
   If Orca is not running, start it with `ORCA open --json` or stop and report.
3. Check whether the repository is already registered:
   ```sh
   ORCA repo list --json
   ```
   If an entry already covers `$REPO_PATH`, report its `repoId` and skip
   registration; the run becomes verification-only.
4. Register the repository:
   ```sh
   ORCA repo add --path "$REPO_PATH" --json
   ```
   Record the returned `repoId`.
5. Optionally set the base ref when the user names one:
   ```sh
   ORCA repo set-base-ref --repo id:<repoId> --ref origin/main --json
   ```
   A base ref pointing at a remote requires that remote to exist; skip with a
   note when the repository has no remote yet.
6. Verify and report:
   ```sh
   ORCA repo show --repo id:<repoId> --json
   ```
   Confirm the path and base ref in the output; report any mismatch as a
   failure, not success.

## Safety Rules

- Never run bare `orca` on Linux outside an Orca-managed terminal; it resolves
  to the GNOME screen reader.
- Never guess subcommands or flags; consult `ORCA skills get orca-cli` when a
  command is rejected, and report rather than improvise.
- Never re-register an already-tracked repository; verify and report instead.
- Never create, modify, or delete worktrees, terminals, remotes, or repository
  contents; this skill only registers and verifies.

## Output Style

Report the resolved executable, repository path, `repoId` (new or existing),
base ref outcome (set, skipped with reason, or default), and the verification
result from `repo show`.
