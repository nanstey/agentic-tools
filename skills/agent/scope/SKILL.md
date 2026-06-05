---
name: scope
description: Confirm and normalize analysis scope at the start of a run using four standard options (current branch, current file, current module, entire codebase), defaulting to current branch, then return a clear scope statement and assumptions. Use when starting reviews, audits, investigations, or other tasks that need explicit boundaries before scanning files.
user-invocable: true
disable-model-invocation: false
---

# Scope

## Core Contract

Use this skill to set analysis scope before scanning files. It exists to avoid
unbounded or ambiguous sweeps and to keep runs reproducible.

Default behavior: confirm scope once at the start, then proceed with the chosen
boundary. If no scope is specified, default to current branch.
If the user already specified scope, confirm it and continue without re-asking.

Treat `CLAUDE.md` / `AGENTS.md` in the target repository as authoritative. If
they define scope constraints, follow them.

## Required Inputs

Gather or infer:

1. The user's goal (review, audit, fix, refactor, etc.).
2. Any scope the user already named.
3. The repository base branch used to define current branch delta.
4. Whether speed (fast signal) or breadth (comprehensive sweep) is preferred.

## Workflow

1. **Check for explicit scope first**
   - If the user already named scope in their request, confirm it and proceed
     without re-asking.

2. **Default immediately when scope is missing**
   - If the user did not specify scope, use current branch automatically.
   - Do not ask a scope-selection question unless the user explicitly asks for
     alternatives.
   - Optional note: they can override scope to current file, current module, or
     entire codebase.

3. **Apply defaults**
   - Current branch is always the fallback when scope is unspecified or unclear.
   - For current branch scope, review `base...HEAD` diff first; include
     unstaged/staged working-tree changes only when present or explicitly requested.

4. **Confirm and restate final scope**
   - Restate exactly what will be scanned.
   - Note any exclusions (generated files, vendored deps, build outputs) when relevant.
   - If entire codebase is selected, explicitly acknowledge slower runtime.
   - If current module is selected and module boundaries are unclear, ask for
     the module path before proceeding.

5. **Stop-and-ask gate**
   - If scope is still ambiguous after one clarification attempt, stop and ask
     for a concrete file/module path; if no answer is provided, default to
     current branch and state that assumption explicitly.

## Implementation Notes

- For current branch, default to branch delta against base (`base...HEAD`) even
  when the working tree is clean.
- Include working-tree changes in addition to `base...HEAD` only when they
  exist or the user explicitly asks for in-progress local edits.
- If both `base...HEAD` and working-tree deltas are empty, state that no active
  delta exists and ask whether to continue with current file/module context.
- For current file, use the focused/open file when available; otherwise ask for a path.
- For current module, infer from repository conventions, then confirm the module
  path explicitly.
- For entire codebase sweeps, prefer a structural skim first, then deeper passes.
- Keep scope decisions explicit in the final response so later steps remain auditable.

## Safety Rules

- Never silently expand scope beyond what was confirmed.
- Never treat "quick look" as permission for a full-repo sweep.
- Never proceed with ambiguous scope when it can change conclusions.

## Output Style

When finishing scope setup, report:

1. Final confirmed scope in one line.
2. Why this scope fits the user goal (one sentence).
3. Any exclusions or assumptions that affect interpretation.
