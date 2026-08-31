---
name: worktree-env
description: Builds a project-specific, idempotent worktree bootstrap that copies approved local configuration, installs dependencies, and allocates collision-free service ports. Use when a repository needs repeatable isolated development environments for Git or Orca worktrees.
user-invocable: true
disable-model-invocation: false
---

# Worktree Environment

## Core Contract

Configure the target repository with one committed, executable worktree setup entrypoint. A newly created worktree must be able to run it to copy approved local configuration, install dependencies reproducibly, allocate non-conflicting ports for every declared local service, and validate the resulting environment.

Before releasing Orca automation, resolve the exact committed ref Orca will use to create worktrees. Verify both the root `orca.yaml` and the setup entrypoint exist in that ref with object inspection such as `git cat-file -e <ref>:orca.yaml` and `git cat-file -e <ref>:<entrypoint>`. Working-tree-only automation is inactive until that ref contains it, and final verification must run from a worktree created at that ref.

Prefer the repository's existing bootstrap, configuration, package-manager, and service contracts. Extend one authoritative setup path instead of introducing a second convention. Follow the target repository's `CLAUDE.md` / `AGENTS.md` on conflict.

Use Git for worktree discovery, the project's existing runtime for safe environment-file updates and port probing, and the installed package manager for dependencies. Orca integration is optional and must use the version-matched `orca-cli` and `computer-use` skills rather than guessed commands or direct edits to Orca's internal state.

## Required Inputs

1. Target repository (default: current repository).
2. Environment files that worktrees need, classified by key: copied runtime input, generated managed value, excluded machine-specific or deployment value, plus required or optional status. Inspect source files by key name only; infer the classifications from loaders, examples, ignore rules, and existing setup commands. Ask only when the repository cannot distinguish development-safe inputs from unrelated secrets.
3. Authoritative dependency bootstrap command. Infer it from repository scripts, lockfiles, package-manager metadata, and existing documentation.
4. Every local service that binds a host port, with its configuration key and allowed range or offset relationship.
5. Optional Orca integration. Enable it when the repository is registered in Orca or the user asks for it.

## Workflow

1. **Establish ownership and scope.**
   - Resolve the repository root, Git common directory, primary checkout, target worktree, and all registered worktrees. Select the target in this order: explicit argument, `ORCA_WORKTREE_PATH`, version-documented alternatives such as `ORCA_ROOT_PATH`, then the current Git worktree.
   - Read the target repository rules and existing setup, dev, config, container, service entrypoints, and root `orca.yaml` when Orca integration is in scope.
   - If an existing project-owned command already configures coupled ports, domains, databases, or local secrets, invoke or extend it; do not reproduce that logic in a generic hook.

2. **Derive one explicit setup contract.**
   - Choose the existing setup location or, absent a convention, `scripts/worktree/setup.sh` for a shell-based repository. Use a project-native executable when it provides safer parsing or cross-platform behavior.
   - Define a key-filtered environment transfer plan: copied runtime inputs, generated managed values, and excluded machine-specific or deployment values. Mark copied inputs required or optional. Never discover secret-bearing files with a runtime wildcard or inspect their values to classify them.
   - Define exactly one reproducible dependency command from repository evidence.
   - Inventory all host-bound services from application config, Compose files, task runners, and dev commands. Record each managed key, preferred port, permitted range, and coupled values such as URLs or project/database names.
   - State the contract before editing. Stop and ask only when replacing existing automation, selecting among competing authoritative commands, or deciding whether a secret-bearing file is safe to replicate.

3. **Implement an idempotent executable.** On every run, the entrypoint must:
   1. Enable strict error handling and resolve paths. Select the target in this order: explicit argument, `ORCA_WORKTREE_PATH`, version-documented alternatives such as `ORCA_ROOT_PATH`, then the current Git worktree.
   2. Reject an unregistered target, a target outside the repository, symlinked local-config destinations, and unintended execution against the primary checkout.
   3. Transfer only allowlisted copied-runtime keys from declared sources to declared worktree destinations. Generate managed keys locally and omit excluded machine-specific or deployment keys. Verify every destination is Git-ignored before writing, create parent directories deliberately, write through owner-only temporary files, atomically rename, and enforce mode `0600`. Missing required sources fail; missing optional sources produce path-only warnings.
   4. Install dependencies with the repository's lockfile-preserving command. Preserve package-manager caches; do not share mutable install trees unless the repository already guarantees that model.
   5. Acquire an interprocess lock in the Git common directory. Under that lock, retain the current worktree's valid allocation on rerun, allocate the complete declared port set as one unit, and prune stale reservations only as crash recovery when their resolved worktree no longer exists. Reject ports reserved by another worktree or bound on loopback/unspecified IPv4 or IPv6 addresses. Bound the search and fail clearly on exhaustion.
   6. Persist reservations atomically in ignored Git-common-dir state keyed by a hash of the resolved worktree path. Generate collision-resistant local project/database identifiers from a readable slug plus that hash. Release a newly created reservation if later configuration fails.
   7. Update managed environment keys as data, never as shell. Preserve unrelated lines, replace one delimited managed block or use the repository's config API, encode values used in URLs, and atomically replace files without changing their restrictive permissions. Never `source`, `eval`, or interpolate an env file as code.
   8. Run the repository's offline config/status validation and a dependency readiness check. Report service names and allocated ports, never secret values. Do not start long-running services unless the repository's existing setup contract explicitly requires it.

4. **Make reruns, failures, and archive cleanup safe.**
   - A second run in the same worktree must preserve its allocation, replace rather than duplicate managed values, and skip already-satisfied work where the package manager supports it.
   - Concurrent setup in two worktrees must not receive overlapping ports.
   - A failed env copy, dependency install, allocation, or validation must exit non-zero and identify the failed phase without printing configuration values.
   - Preserve previously valid local configuration on failure. Do not report success after a warning that leaves required state absent.
   - Provide a committed archive hook that acquires the reservation lock, validates that the archived worktree owns the reservation, and releases it idempotently. Delete a database or container only when persisted setup state proves this setup created it. Keep stale reservation pruning as crash recovery, not normal archive cleanup.

5. **Integrate with Orca when available.**
   - Read the repository root `orca.yaml` before local hook settings, CLI state, or UI. Treat its setup-hook declaration as the baseline, then resolve the correct Orca executable and load the current `orca-cli` guide.
   - Inspect the registered repository and its `hookSettings` with documented CLI JSON commands. Treat local hook settings as explicit overrides of the root configuration.
   - The setup hook must invoke the trusted script from the committed creation base, not a feature branch's mutable copy. The script remains manually runnable from a worktree through its Git fallback.
   - Use documented CLI mutation commands to configure the effective hook when available. Only if they are unavailable, load `computer-use`, inspect the live Orca settings UI, configure the repository's worktree setup command there, then re-read state and verify the exact stored command.
   - Never replace or chain a non-empty effective Orca setup hook without user approval. If UI automation is unavailable or unverifiable, leave Orca unchanged and report the exact command to enter plus the documented `worktree create --setup run` invocation.
   - Never edit Orca databases, preferences, or machine-local implementation files directly.

6. **Verify behavior and preserve regression coverage.**
   - Resolve the exact Orca creation base, then verify `orca.yaml` and the setup entrypoint exist in it with `git cat-file -e`. Create two disposable linked worktrees through Orca at that ref, owned by this verification, and run the committed setup entrypoint in both.
   - Add project-level automated behavioral coverage using the repository's test framework. Cover primary and unregistered target rejection, key-filtered env transfer, concurrent disjoint allocations, rerun stability, occupied-port skipping, live-lock preservation, archive ownership and idempotence, malformed-state refusal, and launcher defaults.
   - Run that regression suite and require it to pass. Keep the real Orca-created worktree exercise above; simulated or plain Git worktrees do not prove creation-base wiring.
   - Confirm every declared env destination exists, is ignored, has restrictive permissions, and contains only copied-runtime or generated-managed keys; inspect key names only.
   - Confirm dependency readiness with the repository's own command.
   - Confirm the two worktrees receive disjoint complete port sets and that a rerun preserves each set without duplicate managed entries.
   - Occupy one preferred port, create another disposable worktree, and confirm allocation skips it. Run the repository's config/status validation there.
   - Confirm setup logs contain paths, service names, and ports but no secret values. Confirm expected setup outputs are ignored and `git status` remains clean in each disposable worktree.
   - Remove only the disposable worktrees and temporary listener created by this verification. Exercise the committed archive hook to release each owned reservation, then confirm it is idempotent. Do not remove user-owned worktrees, local configuration, databases, or containers.

## Git and Package-Manager Implementation Notes

Use machine-readable Git output and resolved absolute paths rather than parsing human summaries:

```text
git rev-parse --show-toplevel
git rev-parse --path-format=absolute --git-common-dir
git worktree list --porcelain -z
git check-ignore -q -- <destination>
```

Select dependency commands from repository evidence. Common lockfile-preserving forms include `npm ci`, `pnpm install --frozen-lockfile`, `yarn install --immutable`, `bun install --frozen-lockfile`, and `uv sync --frozen`; do not choose one merely because its executable is installed. For monorepos, prefer the root workspace command unless existing project automation defines narrower installs.

Probe ports with the project's runtime networking API when possible so IPv4, IPv6, Linux, macOS, and Windows behavior is explicit. Listener checks reduce collisions with unrelated processes but remain time-of-check/time-of-use checks; service startup must still surface address-in-use failures rather than silently selecting an unrecorded port.

For Compose or similar tools, pass the generated env/config path explicitly. A container-level `env_file` does not necessarily provide variables used while parsing the orchestration file.

## Safety Rules

- Never copy every `.env*` file or a whole secret store by glob; use the reviewed, key-filtered transfer plan.
- Never copy production-only, machine-specific, or deployment-only values merely because they are present in the primary checkout.
- Never write a secret-bearing destination until Git ignore status, symlink safety, containment, and permissions are verified.
- Never execute environment-file content, print secret values, inspect values while classifying keys, or export unrelated secrets to child processes.
- Never select ports without a cross-worktree lock and durable reservation, and never treat a probe error as proof that a port is free.
- Never release a reservation without the lock and proof that the archived worktree owns it. Never delete a database or container without persisted proof that this setup created it.
- Never invent dependency, service, teardown, or config commands when the repository has no evidence for them.
- Never overwrite existing setup automation or an Orca hook without explicit approval.
- Never claim Orca readiness unless the creation base contains `orca.yaml` and the setup entrypoint, and the project's own validation succeeds in a real Orca-created worktree at that ref.

## Output Style

Report the target repository, Orca creation base, committed setup entrypoint, environment key classifications and copied paths (names and paths only), dependency command, managed service-to-port mapping, reservation-state location, archive-hook status, Orca hook status, and verification results. List assumptions and any manual Orca action still required. Never include environment values or credentials.
