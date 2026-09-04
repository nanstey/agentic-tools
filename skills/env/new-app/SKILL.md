---
name: new-app
description: Scaffolds a new local software project from scratch — folder structure, git, README, LICENSE, .gitignore, optional CI, and a first commit — delegating language-specific init to the ecosystem's own tool. Use when starting a brand-new local application.
user-invocable: true
disable-model-invocation: false
---

# New App

## Core Contract

Create one new software project from scratch in a fresh directory: run the
stack's own initializer, then add project structure, README, LICENSE,
`.gitignore`, and optional CI, initialize git with one clean first commit.

Stack-agnostic: delegate language-specific initialization to the ecosystem's own
tool (`cargo`, `npm`/`pnpm`/`yarn`, `uv`/`poetry`, `go mod`, `dotnet new`, etc.)
selected from the user's stated stack. Do not bundle or hand-write language
templates when a first-party tool exists.

This skill creates a new local repository, so a target-repo `CLAUDE.md`/`AGENTS.md`
usually does not exist yet; if scaffolding inside an existing workspace that has
one, follow it on conflict.

## Required Inputs

1. Project name and target directory/path.
2. Language/stack/framework — drives which first-party init tool runs.
3. App scope — what the app does and its core features, enough to shape the
   initial structure and README. A bare name is not a scope.
4. One-line purpose/description — for the README (derive from scope).
5. License choice — default `MIT` if unspecified.
6. Optional: CI provider. Skip CI if the user declines.

Stop and ask before scaffolding when any of these is missing:
- Project name, target directory, or stack.
- App scope — never invent features or product intent; ask what to build.

If the instructions are ambiguous, or the scope is broad enough to need design
decisions, offer to start a planning session first (for example, `scrutiny` or
`proposal`) rather than guessing.

## Workflow

1. Gather inputs, restate the plan, and confirm the target directory. Stop and
   ask if name, directory, stack, or app scope is unknown. If the request is
   ambiguous, offer to start a planning session (for example,
   `scrutiny`/`proposal`) before scaffolding.
2. Preflight. Confirm the target directory is nonexistent or empty. If it
   exists and is non-empty, stop and ask. Verify `git` and the chosen stack's
   initializer are present and runnable; flag anything missing before relying on
   it.
3. Run the stack's first-party initializer in the target directory (for example,
   `cargo init`, `npm init -y`, `uv init`, `go mod init <module>`). This
   produces the baseline layout and may auto-create `.gitignore` and/or a git
   repository.
4. Add project scaffolding without overwriting what the initializer produced:
   `README.md` (name, one-line purpose, quickstart), `LICENSE` (canonical text
   for the chosen license), and augment/create `.gitignore` for the stack.
   Create `docs/` and a `tests/` location only if the stack layout does not
   already provide them.
5. Optional CI: add `.github/workflows/ci.yml` running the stack's standard
   build+test (for example, `cargo test`, `npm test`, `go test ./...`) when the
   user wants CI.
6. Initialize git if the initializer did not (`git init -b main`), ensure
   `.gitignore` covers secrets and build artifacts, then stage and make one
   initial commit.
7. Verify and report: run the stack's build/test smoke if one exists; report the
   project path, structure, and git state.
8. If the Orca IDE runs this session, offer to invoke `orca-repo` to register
   the new project with Orca. Skip silently when Orca is not present.
9. If the user wants a GitHub repository, offer to invoke `new-repo` after the
   local work is complete. Do not create or configure a remote in this skill.

Stop and ask when name/directory/stack/scope is unknown or the target directory
is non-empty. Offer a planning session when the request is ambiguous.

## Implementation Notes

Concrete commands (adapt to the chosen stack):

- Git init (when the initializer did not initialize a repository):
  `git init -b main`
- Canonical license text: retrieve it from an authoritative license source
  (for example SPDX or Choose a License) rather than hand-fabricating it.
- `.gitignore`: prefer the initializer's output; otherwise use the chosen
  stack's official template or a reputable generated template.
- Stack init examples: `cargo init` · `npm init -y` (or `pnpm init`) ·
  `uv init` (or `poetry new .`) · `go mod init <module>` · `dotnet new <tmpl>`.
  Some (for example, `cargo init`, `uv init`) also run `git init` — detect and
  avoid a double init.

## Safety Rules

- Never scaffold into an existing non-empty directory without explicit
  confirmation.
- Never overwrite files produced by the stack initializer; run the initializer
  first, then add or merge the remaining files.
- Never assume tooling exists; verify `git` and the stack init tool, and flag
  anything missing before relying on them.
- Never fabricate license text; retrieve canonical text from an authoritative
  source.
- Never commit secrets or build artifacts; ensure `.gitignore` covers them
  before the first commit.
- Never hand-roll a language scaffold when a first-party init tool exists for
  that stack.
- Never create, push to, or configure a GitHub repository. Refer GitHub work to
  `new-repo`.

## Output Style

Report the project path and structure created, the stack init tool run, git
state (branch and first commit hash), tooling verified/missing, Orca
registration outcome (registered, declined, or not applicable), assumptions
made, and suggested next steps. If the user wants a GitHub remote, state that
`new-repo` can create and configure it.
