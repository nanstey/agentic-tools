---
name: new-app
description: Scaffolds a new software project from scratch — folder structure, git, README, LICENSE, .gitignore, optional CI, and a private GitHub repo via `gh` — delegating language-specific init to the ecosystem's own tool. Use when starting a brand-new project or repository.
user-invocable: true
disable-model-invocation: false
---

# New App

## Core Contract

Create one new software project from scratch in a fresh directory: run the
stack's own initializer, then add project structure, README, LICENSE,
`.gitignore`, and optional CI, initialize git with one clean first commit, and
create a GitHub remote via `gh` (default **private**), pushing only after
explicit confirmation.

Stack-agnostic: delegate language-specific initialization to the ecosystem's own
tool (`cargo`, `npm`/`pnpm`/`yarn`, `uv`/`poetry`, `go mod`, `dotnet new`, etc.)
selected from the user's stated stack. Do not bundle or hand-write
language templates when a first-party tool exists.

This skill creates a new repository, so a target-repo `CLAUDE.md`/`AGENTS.md`
usually does not exist yet; if scaffolding inside an existing workspace that has
one, follow it on conflict.

## Required Inputs

1. Project name and target directory/path.
2. Language/stack/framework — drives which first-party init tool runs.
3. One-line purpose/description — for the README.
4. License choice — default `MIT` if unspecified.
5. GitHub: whether to create a remote (default yes), and visibility (default
   **private**).
6. Optional: CI provider — default GitHub Actions when a remote is created;
   skip if the user declines.

If project name, target directory, or stack is missing, stop and ask.

## Workflow

1. Gather inputs, restate the plan, and confirm the target directory. Stop and
   ask if name, directory, or stack is unknown.
2. Preflight. Confirm the target directory is nonexistent or empty; if it
   exists and is non-empty, stop and ask. Verify required tooling is present and
   runnable — `git`, the chosen stack's init tool, and `gh` (with `gh auth
   status`); flag anything missing before relying on it.
3. Run the stack's first-party initializer in the target directory (e.g.
   `cargo init`, `npm init -y`, `uv init`, `go mod init <module>`). This
   produces the baseline layout and may auto-create `.gitignore` and/or a git
   repo.
4. Add project scaffolding without overwriting what the initializer produced:
   `README.md` (name, one-line purpose, quickstart), `LICENSE` (canonical text
   for the chosen license), and augment/create `.gitignore` for the stack.
   Create `docs/` and a `tests/` location only if the stack layout does not
   already provide them.
5. Optional CI: add `.github/workflows/ci.yml` running the stack's standard
   build+test (e.g. `cargo test`, `npm test`, `go test ./...`) when the user
   wants CI.
6. Initialize git if the initializer did not (`git init -b main`), ensure
   `.gitignore` covers secrets and build artifacts, then stage and make one
   initial commit.
7. GitHub. With `gh` available and authenticated, create the remote
   **private** by default (`gh repo create`), set `origin`, and **stop and ask
   before the first push**. If `gh` is missing or unauthenticated, keep the
   project local and print exact manual steps to create and push the remote.
8. Verify and report: run the stack's build/test smoke if one exists; report the
   project path, structure, git state, and remote URL (or local-only status).

Stop and ask when: name/directory/stack is unknown; the target directory is
non-empty; or before the first push to any remote.

## Implementation Notes

Concrete commands (adapt to the chosen stack):

- Git init (when the initializer didn't): `git init -b main`
- Canonical license text: `gh api /licenses/<key> --jq .body` (e.g. `mit`,
  `apache-2.0`); fall back to `curl https://choosealicense.com` guidance if `gh`
  is unavailable. Never hand-fabricate license text.
- `.gitignore`: prefer the initializer's output; otherwise
  `gh api /gitignore/templates/<Name> --jq .source` (e.g. `Rust`, `Node`, `Go`,
  `Python`) or `curl https://www.toptal.com/developers/gitignore/api/<name>`.
- Create remote without pushing, then push after confirmation:
  ```sh
  gh repo create <name> --private --source=. --remote=origin
  # after explicit confirmation:
  git push -u origin main
  ```
  Do not use `gh repo create --push` (it pushes immediately, bypassing the
  confirmation gate).
- Stack init examples: `cargo init` · `npm init -y` (or `pnpm init`) ·
  `uv init` (or `poetry new .`) · `go mod init <module>` · `dotnet new <tmpl>`.
  Some (e.g. `cargo init`, `uv init`) also run `git init` — detect and avoid a
  double init.

## Safety Rules

- Never scaffold into an existing non-empty directory without explicit confirmation.
- Never overwrite files produced by the stack initializer; run the initializer
  first, then add or merge the remaining files.
- Never create a public repository or push to any remote without explicit
  confirmation; default visibility is private.
- Never assume tooling exists; verify `git`, `gh` (and its auth), and the stack
  init tool, and flag anything missing before relying on it.
- Never fabricate license text; fetch canonical text from an authoritative source.
- Never commit secrets or build artifacts; ensure `.gitignore` covers them
  before the first commit.
- Never hand-roll a language scaffold when a first-party init tool exists for
  that stack.

## Output Style

Report the project path and structure created, the stack init tool run, git
state (branch and first commit hash), GitHub repo URL and visibility (or
local-only with the printed manual steps), tooling verified/missing, assumptions
made, and suggested next steps.
