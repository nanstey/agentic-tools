# Agentic tools

Reusable tools for real engineering work across machines and projects.

| Tool Type | Description |
| --- | --- |
| **Skills** | Portable `SKILL.md` workflows for reliable end-to-end tasks. |
| **Agent profiles** | Claude Code subagents I can delegate focused work to. |
| **Loops** | `LOOP.md` runbooks that orchestrate agents and skills into iterative, self-verifying processes. |

## Quick Start

Clone the repo:
```sh
git clone git@github.com:nanstey/agentic-tools.git
```

Install or update the tools:
```sh
bash install.sh
```

## Portable pi config

`pi/` holds the portable, non-secret pi configuration that `install.sh` copies
into `~/.pi/agent` (it is **copied**, not symlinked, because pi rewrites these
files locally):

| File | Purpose |
| --- | --- |
| `pi/settings.json` | Defaults + the `packages` list (the extension manifest). |
| `pi/extensions/*.json` | Per-extension config. |
| `pi/command-shortcuts.json` | Command shortcut bindings. |
| `pi/keybindings.json` | Custom keybindings. |

Secrets and machine-local state (`auth.json`, `auth-profiles/`, `web-search.json`,
`trust.json`, sessions, run history) are git-ignored and never travel — re-auth
per machine with `/login`.

To pull live config changes back into the repo, use the [`pi-sync`](.agents/skills/pi-sync/SKILL.md)
skill (allowlist-based; it never reads or copies secrets).

### New machine bootstrap
```sh
git clone git@github.com:nanstey/agentic-tools.git ~/Code/skills
cd ~/Code/skills && bash install.sh   # links skills + agents, copies pi config
pi                                     # installs packages from settings.json
/login anthropic                       # re-auth (secrets are never synced)
```

## Skills

### Dev

| Skill | Description |
| --- | --- |
| [`changes`](skills/dev/changes/SKILL.md) | Summarize staged/unstaged changes into logical groups and flag unrelated edits. Read-only. |
| [`build`](skills/dev/build/SKILL.md) | Implements scoped changes from context, plans, or speclists through verifiable phases with up-front success criteria and per-phase validation. |
| [`commit`](skills/dev/commit/SKILL.md) | Group current changes into clean commit(s), run hooks, and push to `origin` by default. |
| [`rebase`](skills/dev/rebase/SKILL.md) | Rebase onto latest `main`/`develop`; hand conflicts to `conflicts`; force-push with lease. |
| [`conflicts`](skills/dev/conflicts/SKILL.md) | Resolve merge/rebase/cherry-pick/revert conflicts and continue the stopped operation. |
| [`branch`](skills/dev/branch/SKILL.md) | Create a new branch for current/proposed changes, deriving a conventional `<type>/<slug>` name when none is given. |
| [`worktree`](skills/dev/worktree/SKILL.md) | Create or reuse a git worktree for a branch (local, remote-only, or new) and report its path. |

### Planning

| Skill | Description |
| --- | --- |
| [`proposal`](skills/planning/proposal/SKILL.md) | Run discovery and uncertainty resolution for a change, then write a terse plan document covering purpose, behaviour, validation, architecture, and phased vertical slices. Read-only. |
| [`speclist`](skills/planning/speclist/SKILL.md) | Convert reports into ordered implementation checklists with blockers and validation steps. |

### Agent

| Skill | Description |
| --- | --- |
| [`context-engineering`](skills/agent/context-engineering/SKILL.md) | Audit a scope (skill, system prompt, tool set, CLAUDE.md, project) against context engineering best practices and apply improvements. |
| [`scope`](skills/agent/scope/SKILL.md) | Confirm and normalize analysis scope, then return clear scope assumptions before scanning files. |
| [`reflect`](skills/agent/reflect/SKILL.md) | Review the current session for problems and their fixes, then propose durable improvements to repo skills, scripts, or docs that prevent recurrence. |

### Writing

| Skill | Description |
| --- | --- |
| [`terse`](skills/writing/terse/SKILL.md) | Keep responses concise, outcome-first, and high signal. |
| [`deslop`](skills/writing/deslop/SKILL.md) | Remove AI writing patterns, tells, and formulaic slop from prose. |

### Pull Requests

| Skill | Description |
| --- | --- |
| [`pr`](skills/pull-requests/pr/SKILL.md) | Run the full PR checklist by chaining the `pr-*` skills in order. |
| [`pr-info`](skills/pull-requests/pr-info/SKILL.md) | Find and verify the branch PR (or a URL) and load its metadata. Read-only. |
| [`pr-ci`](skills/pull-requests/pr-ci/SKILL.md) | Diagnose failed PR CI jobs, fix root causes, validate, commit, and push. |
| [`pr-create`](skills/pull-requests/pr-create/SKILL.md) | Create a draft PR for the current branch when none exists. |
| [`pr-comments`](skills/pull-requests/pr-comments/SKILL.md) | Triage unresolved review threads, apply fixes, validate, commit, push, and resolve/reply. |
| [`pr-description`](skills/pull-requests/pr-description/SKILL.md) | Sync the PR title and description to current branch changes and maintain checklist accuracy. |
| [`pr-rebase`](skills/pull-requests/pr-rebase/SKILL.md) | Rebase onto latest `origin/develop`, resolve conflicts, and force-push with lease. |
| [`pr-restack`](skills/pull-requests/pr-restack/SKILL.md) | Rebase dependent PR stacks and repoint downstream branches to correct bases. |
| [`pr-split`](skills/pull-requests/pr-split/SKILL.md) | Split a large branch/PR into smaller reviewable units, proposing parallel PRs or a stacked series. |

### Issues

| Skill | Description |
| --- | --- |
| [`issue-create`](skills/issues/issue-create/SKILL.md) | Create a GitHub issue from context and optional metadata. |

### Code quality

| Skill | Description |
| --- | --- |
| [`deep-review`](skills/code-quality/deep-review/SKILL.md) | Strict maintainability review focused on abstractions, oversized files, and condition sprawl. |
| [`dry`](skills/code-quality/dry/SKILL.md) | Read-only DRY review that ranks duplication and proposes concrete consolidations. |
| [`srp`](skills/code-quality/srp/SKILL.md) | Evaluate Single Responsibility Principle violations and recommend cohesive boundaries. |
| [`extract`](skills/code-quality/extract/SKILL.md) | Identify extraction opportunities from DRY/SRP findings and propose reusable boundaries. |
| [`principles`](skills/code-quality/principles/SKILL.md) | Apply core design principles through a concise implementation/review checklist. |
| [`sniff`](skills/code-quality/sniff/SKILL.md) | Run smell analysis and map findings to standard smells and refactor options. |
| [`fresh-air`](skills/code-quality/fresh-air/SKILL.md) | Recommend best-fit refactoring techniques for smell findings with confidence. |
| [`refactor`](skills/code-quality/refactor/SKILL.md) | Orchestrate smell validation, technique selection, and final implementation planning. |

### Authoring (project skills)

| Skill | Description |
| --- | --- |
| [`check-skill-name`](.agents/skills/check-skill-name/SKILL.md) | Check skill names for collisions and return CLEAR/CONFLICT/RISKY plus safe alternatives. |
| [`pi-sync`](.agents/skills/pi-sync/SKILL.md) | Capture portable, non-secret pi config from a live `~/.pi/agent` into `pi/` and commit it, without touching secrets. |
| [`make-skill`](.agents/skills/make-skill/SKILL.md) | Plan and scaffold a convention-compliant repo skill, including name validation. |
| [`make-agent`](.agents/skills/make-agent/SKILL.md) | Plan and scaffold a convention-compliant repo agent profile and align the catalog. |
| [`make-loop`](.agents/skills/make-loop/SKILL.md) | Plan and scaffold a convention-compliant loop runbook (`LOOP.md`) and align the catalog. |

## Agents

Claude Code subagents for focused delegated work.

| Agent | Description |
| --- | --- |
| [`worker`](agents/worker.md) | Implementation agent for normal tasks and approved oracle handoffs. Single writer thread; escalates unapproved decisions via `contact_supervisor`. |
| [`scout`](agents/scout.md) | Fast codebase recon that returns compressed context for handoff. Writes `context.md`. |
| [`researcher`](agents/researcher.md) | Autonomous web researcher — searches, evaluates, and synthesizes a focused research brief into `research.md`. |
| [`planner`](agents/planner.md) | Creates concrete implementation plans from context and requirements. Read-only; writes `plan.md`. |
| [`reviewer`](agents/reviewer.md) | Versatile review specialist for code diffs, plans, proposed solutions, codebase health, and PR/issue validation. |
| [`context-builder`](agents/context-builder.md) | Analyzes requirements and codebase; generates `context.md` and `meta-prompt.md` for planning and subagent handoffs. |
| [`oracle`](agents/oracle.md) | High-context decision-consistency oracle that protects inherited state and prevents drift. Read-only. |
| [`delegate`](agents/delegate.md) | Lightweight subagent that inherits the parent model with no default reads. General-purpose delegated execution. |

## Loops

Agent-driven runbooks that orchestrate agents and skills (trigger → iterate →
verifiable goal/brake). Each loop ships a `SKILL.md` entrypoint shim and installs
into the skills dir of agent-capable harnesses (pi, claude), so it is searchable
as a `skill:<name>` command that reads and runs the loop's `LOOP.md`.

| Loop | Description |
| --- | --- |
| [`green-ci`](loops/green-ci/LOOP.md) | Iterate fix-and-verify cycles on the current branch until CI is green or a brake trips. |
