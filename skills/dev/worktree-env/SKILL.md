---
name: worktree-env
description: Builds a project-specific, idempotent worktree bootstrap that copies approved local configuration, installs dependencies, and allocates collision-free service ports. Use when a repository needs repeatable isolated development environments for Git or Orca worktrees.
user-invocable: true
disable-model-invocation: false
---

# Worktree Environment

## Core Contract

Configure the target repository with one committed, executable worktree setup entrypoint. A newly created worktree must be able to run it to copy an explicit set of local environment files, install dependencies reproducibly, allocate non-conflicting ports for every declared local service, and validate the resulting environment.

Prefer the repository's existing bootstrap, configuration, package-manager, and service contracts. Extend one authoritative setup path instead of introducing a second convention. Follow the target repository's `CLAUDE.md` / `AGENTS.md` on conflict.

Use Git for worktree discovery, the project's existing runtime for safe environment-file updates and port probing, and the installed package manager for dependencies. Orca integration is optional and must use the version-matched `orca-cli` and `computer-use` skills rather than guessed commands or direct edits to Orca's internal state.

## Required Inputs

1. Target repository (default: current repository).
2. Environment files that worktrees need, including which are required or optional. Infer this from loaders, examples, ignore rules, and existing setup commands; ask only if the repository cannot distinguish development-safe inputs from unrelated secrets.
3. Authoritative dependency bootstrap command. Infer it from repository scripts, lockfiles, package-manager metadata, and existing documentation.
4. Every local service that binds a host port, with its configuration key and allowed range or offset relationship.
5. Optional Orca integration. Enable it when the repository is registered in Orca or the user asks for it.

## Workflow

1. **Establish ownership and scope.**
   - Resolve the canonical repository root, Git common directory, primary checkout, target worktree, and all registered worktrees.
   - Read the target repository rules and existing setup, dev, config, container, and service entrypoints.
   - If an existing project-owned command already configures coupled ports, domains, databases, or local secrets, invoke or extend it; do not reproduce that logic in a generic hook.

2. **Derive one explicit setup contract.**
   - Choose the existing setup location or, absent a convention, `scripts/worktree/setup.sh` for a shell-based repository. Use a project-native executable when it provides safer parsing or cross-platform behavior.
   - Define an allowlist of source-to-destination environment files. Mark each required or optional. Never discover secret-bearing files with a runtime wildcard.
   - Define exactly one reproducible dependency command from repository evidence.
   - Inventory all host-bound services from application config, Compose files, task runners, and dev commands. Record each managed key, preferred port, permitted range, and coupled values such as URLs or project/database names.
   - State the contract before editing. Stop and ask only when replacing existing automation, selecting among competing authoritative commands, or deciding whether a secret-bearing file is safe to replicate.

3. **Implement an idempotent executable.** On every run, the entrypoint must:
   1. Enable strict error handling and resolve canonical paths. Accept an explicit target path, Orca's documented worktree environment when present, and the current Git worktree as the manual-run fallback.
   2. Reject an unregistered target, a target outside the repository, symlinked local-config destinations, and unintended execution against the primary checkout.
   3. Copy only the declared environment files from the primary checkout to the same declared worktree destinations. Verify every destination is Git-ignored before writing, create parent directories deliberately, write through owner-only temporary files, atomically rename, and enforce mode `0600`. Missing required sources fail; missing optional sources produce path-only warnings.
   4. Install dependencies with the repository's lockfile-preserving command. Preserve package-manager caches; do not share mutable install trees unless the repository already guarantees that model.
   5. Acquire an interprocess lock in the Git common directory. Under that lock, prune reservations whose canonical worktree no longer exists, retain the current worktree's valid allocation on rerun, and allocate the complete declared port set as one unit. Reject ports reserved by another worktree or bound on loopback/unspecified IPv4 or IPv6 addresses. Bound the search and fail clearly on exhaustion.
   6. Persist reservations atomically in ignored Git-common-dir state keyed by a hash of the canonical worktree path. Generate collision-resistant local project/database identifiers from a readable slug plus that hash. Release a newly created reservation if later configuration fails.
   7. Update managed environment keys as data, never as shell. Preserve unrelated lines, replace one delimited managed block or use the repository's config API, encode values used in URLs, and atomically replace files without changing their restrictive permissions. Never `source`, `eval`, or interpolate an env file as code.
   8. Run the repository's offline config/status validation and a dependency readiness check. Report service names and allocated ports, never secret values. Do not start long-running services unless the repository's existing setup contract explicitly requires it.

4. **Make reruns and failures safe.**
   - A second run in the same worktree must preserve its allocation, replace rather than duplicate managed values, and skip already-satisfied work where the package manager supports it.
   - Concurrent setup in two worktrees must not receive overlapping ports.
   - A failed env copy, dependency install, allocation, or validation must exit non-zero and identify the failed phase without printing configuration values.
   - Preserve previously valid local configuration on failure. Do not report success after a warning that leaves required state absent.

5. **Integrate with Orca when available.**
   - Resolve the correct Orca executable and load the current `orca-cli` guide. Inspect the registered repository and its `hookSettings` with the documented JSON commands.
   - The setup hook must invoke the trusted script from the primary checkout, not a feature branch's mutable copy. The script remains manually runnable from a worktree through its Git fallback.
   - If Orca exposes no supported hook-settings mutation command, load `computer-use`, inspect the live Orca settings UI, and configure the repository's worktree setup command there. Re-read state and verify the exact stored command.
   - Never replace or chain a non-empty existing Orca setup hook without user approval. If UI automation is unavailable or unverifiable, leave Orca unchanged and report the exact command to enter plus the documented `worktree create --setup run` invocation.
   - Never edit Orca databases, preferences, or machine-local implementation files directly.

6. **Verify behavior in real linked worktrees.**
   - Create two disposable linked worktrees owned by this verification, run the committed setup entrypoint in both, and confirm every declared env destination exists, is ignored, and has restrictive permissions.
   - Confirm dependency readiness with the repository's own command.
   - Confirm the two worktrees receive disjoint complete port sets and that a rerun preserves each set without duplicate managed entries.
   - Occupy one preferred port, create another disposable worktree, and confirm allocation skips it. Run the repository's config/status validation there.
   - Confirm setup logs contain paths, service names, and ports but no secret values. Confirm expected setup outputs are ignored and `git status` remains clean in each disposable worktree.
   - Remove only the disposable worktrees and temporary listener created by this verification, then prune their reservations. Do not remove user-owned worktrees or local configuration.

## Git and Package-Manager Implementation Notes

Use machine-readable Git output and canonical paths rather than parsing human summaries:

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

- Never copy every `.env*` file or a whole secret store by glob; use the reviewed allowlist.
- Never copy production-only credentials merely because they are present in the primary checkout.
- Never write a secret-bearing destination until Git ignore status, symlink safety, containment, and permissions are verified.
- Never execute environment-file content, print secret values, or export unrelated secrets to child processes.
- Never select ports without a cross-worktree lock and durable reservation, and never treat a probe error as proof that a port is free.
- Never invent dependency, service, teardown, or config commands when the repository has no evidence for them.
- Never overwrite existing setup automation or an Orca hook without explicit approval.
- Never claim readiness unless the setup entrypoint and the project's own validation succeed in a real disposable worktree.

## Output Style

Report the target repository, committed setup entrypoint, environment paths copied (paths only), dependency command, managed service-to-port mapping, reservation-state location, Orca hook status, and verification results. List assumptions and any manual Orca action still required. Never include environment values or credentials.
