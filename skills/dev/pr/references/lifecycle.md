
# PR

## Core Contract

Prepare the current branch for an open pull request, self-review it with automatic fixes, then invoke `/pr monitor` with `mode: once`. This skill owns setup only; `/pr monitor` owns all subsequent PR health and update work.

With `auto-merge`, invoke `/pr monitor` with `mode: monitor` instead, and when it returns `clean`, invoke `/pr merge` for the same PR. `/pr monitor` marks the draft ready (via `/pr ready`) once its draft snapshot is clean and then re-observes the ready head; `/pr merge` owns the merge gates and squash merge; this skill never merges directly.

Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch or PR URL/number.
2. Optional setup steps to skip (`review` skips the self-review).
3. Optional `auto-merge` flag.

## Workflow

1. Run `/git changes` first to resolve the comparison scope and record the exact base and head refs. When an existing PR is found, use `/pr info` for its base and head.
2. If `/git changes` reports uncommitted work:
   - on `main` or `develop`, create a branch with `/git branch`, then `/git commit` the work;
   - otherwise, `/git commit` the work.
3. Invoke `/pr info` to resolve and verify an existing PR.
4. If no PR exists, invoke `/pr create` (never raw `gh pr create`, including `--fill`), then use its resulting PR as the target. `/pr create` must run `/pr description`; confirm the body has the structured sections (`## Summary`, `## Changes`, `## Testing`) and the PR is a draft. If not, run `/pr description` now. Stop on any other `/pr info` gate.
5. Invoke `/pr review <PR> fix` once for the verified or newly created PR's current head, unless `review` is skipped, the author is not the viewer, or that head was already self-reviewed in this invocation. It reviews, applies fixes, validates, commits, and pushes. Findings it leaves unapplied are reported, not blockers; a validation failure, push failure, or unexpected state is a stop gate. Do not re-review the fix commit.
6. Invoke `/pr monitor` for the same PR (re-resolved with `/pr info` if review pushed): `mode: once` by default, `mode: monitor` with `auto-merge`.
7. With `auto-merge`, if `/pr monitor` returned `clean`, invoke `/pr merge` for the same PR. If it returned `blocked`, `/pr merge` stops at a gate, or the self-review left an unapplied `blocker` or `high` finding, report the blocker and do not merge.
8. Report the setup outcomes, the engine result, and the merge result when `auto-merge` was requested.

Stop as blocked when setup fails, a setup delegate reaches its stop gate, or the branch enters an unexpected state.

## Safety Rules

- Never continue from uncommitted work on `main` or `develop` without first creating a branch and committing it.
- Never continue past a failed setup step or its stop gate; report it as blocked instead.
- Never proceed when unexpected working-tree changes appear during setup.
- Never post review comments or approve from the lifecycle; self-review is `fix` mode on your own PR only, once per head.
- Never create a PR with raw `gh pr create` or reuse a commit message as the body; always go through `/pr create` and its `/pr description` step.
- Never perform PR health or update work directly; invoke `/pr monitor`.
- Never merge without `auto-merge`, and never merge directly; invoke `/pr merge` only after a `clean` `/pr monitor` result.

## Output Style

Report the comparison scope; branch and commit outcomes; existing or newly created PR; the self-review outcome (findings applied vs unapplied, fix commits, push status, or skipped); the `/pr monitor` result, including its final head OID and any blocker; and, with `auto-merge`, the `/pr merge` result or the reason merge was skipped.
