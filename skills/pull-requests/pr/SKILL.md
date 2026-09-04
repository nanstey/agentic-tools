---
name: pr
description: Prepares a branch and invokes `pr-monitor` once for PR reconciliation. Use when a branch should be prepared and checked through one PR-health pass.
user-invocable: true
disable-model-invocation: false
---

# PR

## Core Contract

Prepare the current branch for an open pull request, then invoke `pr-monitor` with `mode: once`. This skill owns setup only; `pr-monitor` owns all subsequent PR health and update work.

Follow `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Current branch or PR URL/number.
2. Optional setup steps to skip.

## Workflow

1. Run `changes` first to resolve the comparison scope and record the exact base and head refs. When an existing PR is found, use `pr-info` for its base and head.
2. If `changes` reports uncommitted work:
   - on `main` or `develop`, create a `branch`, then `commit` the work;
   - otherwise, `commit` the work.
3. Invoke `pr-info` to resolve and verify an existing PR.
4. If no PR exists, invoke `pr-create`, then use its resulting PR as the target. Stop on any other `pr-info` gate.
5. Invoke `pr-monitor` with `mode: once` for the verified or newly created PR. Report the setup outcomes and the engine result.

Stop and ask when setup fails, a setup delegate reaches its stop gate, or the branch enters an unexpected state.

## Safety Rules

- Never continue from uncommitted work on `main` or `develop` without first creating a branch and committing it.
- Never continue past a failed setup step or its stop gate without user approval.
- Never proceed when unexpected working-tree changes appear during setup.
- Never perform PR health or update work directly; invoke `pr-monitor` in `once` mode.

## Output Style

Report the comparison scope; branch and commit outcomes; existing or newly created PR; and the `pr-monitor` result, including its final head OID and any blocker.
