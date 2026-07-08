---
name: context-tree
description: Generates, maintains, and traverses a co-located tree of CONTEXT.md index files and single-concept knowledge files (loosely OKF) so agents and humans can find subsystem background while minimizing tokens. Use when building or refreshing a repo's knowledge tree, or when traversing it to extract minimal context for a task.
user-invocable: true
disable-model-invocation: false
---

# Context Tree

## Core Contract

Build and maintain a tree of context indexes and knowledge files that mirrors the
codebase, then traverse it to surface the smallest high-signal context for a task.

- Every major folder, including the repo root, holds a `CONTEXT.md` index.
- Each knowledge file captures exactly one entity, concept, or pattern, lives loose
  alongside the code it explains, and references code only at its own level or below.
- A top-level `docs/` holds only repo-wide cross-cutting concepts that cannot live in
  one subtree; subtree-spanning concepts stay in that subtree's folder, not `docs/`.
- Output loosely follows OKF (`SPEC.md`): knowledge files are concept docs with YAML
  frontmatter; `CONTEXT.md` is the `index.md` role (renamed) with token estimates added.
- `generate`/`update` mutate the target repo; `traverse` is read-only.
- All modes delegate to subagents with clean context and condensed returns: generation and
  maintenance run one subagent per tree node; traversal runs a subagent that descends the
  tree and returns only the assembled context. The orchestrator stays out of raw source and
  raw tree files. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Keep all prose terse.

## Required Inputs

1. Mode: `generate`, `update`, or `traverse`. When unspecified: default `traverse` if a tree exists, else `generate`.
2. Target root (default: repo root / cwd).
3. For `traverse`: the task or question to gather context for.
4. Scope limits: folders to include/exclude beyond the default exclusions.
5. Optional `--pack <path>`: for `traverse`, also write a token-budgeted context pack file.

## File Formats

### Knowledge file (`<concept>.md`, loose beside code)

```yaml
---
type: Concept | Pattern | Entity | Subsystem   # OKF-required
title: Human-readable name
description: one-line summary
tags: [area, topic]
code_refs: [relative/path/at-or-below.ext]     # same level or below only
related: [/path/to/other-concept.md]           # bundle-relative links
timestamp: <ISO8601>
source_rev: <git blob/commit or content hash>  # drift detection
---
```

Body explains the concept: relationships, reasoning, essential properties, and design
choices. It does **not** restate implementation line by line. Link related concepts
inline (bundle-relative). Optional `# Citations` for external sources.

### CONTEXT.md (index, no frontmatter)

Group entries; every entry carries path, name, description, and estimated tokens:

```markdown
# Knowledge (this level)
* [Name](./concept.md) — brief description (~420 tokens)

# Subtrees
* [auth/](./auth/CONTEXT.md) — what this subtree covers (~1.2k tokens)
```

Token estimates are heuristic (bytes/4 or `wc`); precise enough for budgeting traversal.

### Canonical example

Layout (knowledge files loose beside code; `docs/` only for repo-wide concerns):

```
repo/
├── CONTEXT.md
├── docs/
│   ├── CONTEXT.md
│   └── error-handling.md        # repo-wide pattern, can't localize
└── src/
    └── auth/
        ├── CONTEXT.md
        ├── session-lifecycle.md  # subtree-spanning concept, stays here
        ├── token.ts
        └── session.ts
```

`repo/CONTEXT.md`:

```markdown
# Subtrees
* [src/auth/](src/auth/CONTEXT.md) — authn/session subsystem (~1.4k tokens)

# Cross-cutting
* [docs/](docs/CONTEXT.md) — repo-wide concepts and patterns (~900 tokens)
```

`src/auth/CONTEXT.md`:

```markdown
# Knowledge (this level)
* [Session lifecycle](./session-lifecycle.md) — how sessions are issued, refreshed, revoked (~480 tokens)
```

`src/auth/session-lifecycle.md`:

```markdown
---
type: Concept
title: Session lifecycle
description: How sessions are issued, refreshed, and revoked.
tags: [auth, session]
code_refs: [session.ts, token.ts]
related: [/docs/error-handling.md]
timestamp: 2026-06-25T00:00:00Z
source_rev: a1b2c3d
---

Sessions bind a verified identity to a short-lived token plus a longer-lived
refresh handle. Refresh rotates the token without re-authenticating; revocation
invalidates both. Failures surface through the repo-wide
[error-handling](/docs/error-handling.md) pattern.
```

## Workflow

### Mode: generate (bottom-up, post-order)

1. Map the tree. Pick "major folders": source-bearing dirs, gitignore-aware, excluding
   deps/vendor/build/generated output. Include test dirs but describe their architecture,
   not individual cases.
2. Process **leaves first**. Spawn a subagent per leaf with clean context: it reads only
   that folder's code, extracts distinct concepts, writes one knowledge file per concept
   (placement rule: reference code only at this level or below), writes the folder
   `CONTEXT.md`, and returns a 1–2k-token summary.
3. **Roll up to parents.** A parent subagent consumes children's summaries and
   `CONTEXT.md` files (not raw child code) plus its own direct files; extracts concepts
   that span its children or sit at its level; writes knowledge files and a `CONTEXT.md`
   pointing to sibling knowledge files and child `CONTEXT.md`s.
4. **Hoist to `docs/` only for repo-wide concerns.** A concept spanning one subtree stays
   in that subtree's folder; only concepts relevant across multiple top-level subtrees move
   to `docs/`, which gets its own `CONTEXT.md`.
5. Write the **root `CONTEXT.md`** pointing to top-level subtrees and `docs/`.
6. Report the tree shape, file counts, and any folders skipped.

### Mode: update

1. For each knowledge file, recompute `source_rev` from `code_refs` (git blob/commit when
   the repo is a git work tree; content hash otherwise).
2. Re-run subagents only on drifted subtrees; leave unchanged subtrees untouched.
3. Reconcile each `CONTEXT.md`: add new entries, prune deleted targets, refresh
   descriptions and token estimates.
4. Append an optional `log.md` entry per touched folder (OKF `log.md` form).
5. Report drifted/regenerated nodes and reconciled indexes.

### Mode: traverse (read-only)

Delegate to a traversal subagent so the orchestrator never loads the raw tree; it receives
only the subagent's condensed return. The subagent:

1. Reads the root `CONTEXT.md`. Uses entry descriptions and token estimates to choose only
   the branches relevant to the task.
2. Descends, loading child `CONTEXT.md`s and knowledge files just in time; never loads a
   branch whose description does not match the task.
3. Follows `related` links when they add needed concepts.
4. Returns assembled context. If `--pack <path>` is set, also writes a token-budgeted
   context pack (highest-signal concepts first until budget is hit).
5. Returns which branches were entered, which were skipped, and total tokens loaded.

For a large or wide tree, fan out parallel subagents per top-level branch and merge their
returns.

Stop and ask when the target root is ambiguous, no tree exists for `update`/`traverse`,
or the requested scope conflicts with detected exclusions.

## pi-subagents Notes

- Generate/update: fan out leaves in parallel (`tasks`/`parallel`); roll up parents
  sequentially so each parent can read finished child `CONTEXT.md`s.
- Traverse: run one read-only subagent that descends the tree, or fan out one subagent per
  relevant top-level branch and merge returns.
- Give each subagent a clean/fresh context and require a condensed (1–2k token) return,
  not raw file dumps — the durable record is the written `CONTEXT.md` and knowledge files;
  for traverse it is the returned context (and optional pack file).
- Pass each subagent its folder path, allowed `code_refs` scope, and the placement rule.

## Safety Rules

- Never let a knowledge file reference code above its own folder; move the file up instead.
- Never hoist a subtree-local concept into top-level `docs/`; keep it in its subtree.
- Never dump exhaustive implementation detail into knowledge files; capture concepts only.
- Never mutate the repo in `traverse` mode.
- Never regenerate undrifted subtrees in `update` mode.
- Never write more than one entity, concept, or pattern per knowledge file.
- Never index a target that does not exist; keep `CONTEXT.md` entries in sync with disk.

## Output Style

Report the mode, target root, tree shape (or branches traversed), files written or
updated, drift findings for `update`, total tokens loaded for `traverse`, and any folders
skipped or questions raised.
