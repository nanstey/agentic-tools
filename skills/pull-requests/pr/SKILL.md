---
name: pr
description: Runs the PR creation and maintenance checklist for the current branch, optionally through to merge. Use when a branch should be committed, opened as a PR, reconciled with review and CI, and optionally merged with `--auto-merge`.
user-invocable: true
disable-model-invocation: false
---

# PR

## Core Contract

Prepare the current branch for an open pull request, then invoke `pr-monitor` with `mode: once`. This skill owns setup only; `pr-monitor` owns all subsequent PR health and update work.

With `--auto-merge`, invoke `pr-monitor` with `mode: monitor` instead, and when it returns `clean`, invoke `pr-merge` for the same PR. `pr-merge` owns the ready-for-review conversion, merge gates, and squash merge; this skill never merges directly.

Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch or PR URL/number.
2. Optional setup steps to skip.
3. Optional `--auto-merge` flag.

## Workflow

1. Run `changes` first to resolve the comparison scope and record the exact base and head refs. When an existing PR is found, use `pr-info` for its base and head.
2. If `changes` reports uncommitted work:
   - on `main` or `develop`, create a `branch`, then `commit` the work;
   - otherwise, `commit` the work.
3. Invoke `pr-info` to resolve and verify an existing PR.
4. If no PR exists, invoke `pr-create`, then use its resulting PR as the target. Stop on any other `pr-info` gate.
5. Invoke `pr-monitor` for the verified or newly created PR: `mode: once` by default, `mode: monitor` with `--auto-merge`.
6. With `--auto-merge`, if `pr-monitor` returned `clean`, invoke `pr-merge` for the same PR. If it returned `blocked`, or `pr-merge` stops at a gate, report the blocker and do not merge.
7. Report the setup outcomes, the engine result, and the merge result when `--auto-merge` was requested.

Stop and ask when setup fails, a setup delegate reaches its stop gate, or the branch enters an unexpected state.

## Safety Rules

- Never continue from uncommitted work on `main` or `develop` without first creating a branch and committing it.
- Never continue past a failed setup step or its stop gate without user approval.
- Never proceed when unexpected working-tree changes appear during setup.
- Never perform PR health or update work directly; invoke `pr-monitor`.
- Never merge without `--auto-merge`, and never merge directly; invoke `pr-merge` only after a `clean` `pr-monitor` result.

## Output Style

Report the comparison scope; branch and commit outcomes; existing or newly created PR; the `pr-monitor` result, including its final head OID and any blocker; and, with `--auto-merge`, the `pr-merge` result or the reason merge was skipped.
