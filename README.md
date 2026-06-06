# Agentic tools

Reusable tools for real engineering work across machines and projects.

| Tool Type | Description |
| --- | --- |
| **Skills** | Portable `SKILL.md` workflows for reliable end-to-end tasks. |
| **Agent profiles** | Claude Code subagents I can delegate focused work to. |

## Quick Start

Clone the repo:
```sh
git clone git@github.com:nanstey/agentic-tools.git
```

Install or update the tools:
```sh
bash install.sh
```

## Skills

### Dev

| Skill | Description |
| --- | --- |
| [`changes`](skills/dev/changes/SKILL.md) | Summarize staged/unstaged changes into logical groups and flag unrelated edits. Read-only. |
| [`build`](skills/dev/build/SKILL.md) | Turn scoped context or plans into code changes, validation, and clear outcomes. |
| [`commit`](skills/dev/commit/SKILL.md) | Group current changes into clean commit(s), run hooks, and push to `origin` by default. |
| [`rebase`](skills/dev/rebase/SKILL.md) | Rebase onto latest `main`/`develop`; hand conflicts to `conflicts`; force-push with lease. |
| [`conflicts`](skills/dev/conflicts/SKILL.md) | Resolve merge/rebase/cherry-pick/revert conflicts and continue the stopped operation. |
| [`speclist`](skills/dev/speclist/SKILL.md) | Convert reports into ordered implementation checklists with blockers and validation steps. |

### Agent

| Skill | Description |
| --- | --- |
| [`terse`](skills/agent/terse/SKILL.md) | Keep responses concise, outcome-first, and high signal. |

### Pull Requests

| Skill | Description |
| --- | --- |
| [`pr-info`](skills/pull-requests/pr-info/SKILL.md) | Find and verify the branch PR (or a URL) and load its metadata. Read-only. |
| [`pr-ci`](skills/pull-requests/pr-ci/SKILL.md) | Diagnose failed PR CI jobs, fix root causes, validate, commit, and push. |
| [`pr-comments`](skills/pull-requests/pr-comments/SKILL.md) | Triage unresolved review threads, apply fixes, validate, commit, push, and resolve/reply. |
| [`pr-description`](skills/pull-requests/pr-description/SKILL.md) | Sync the PR description to current branch changes and maintain checklist accuracy. |
| [`pr-rebase`](skills/pull-requests/pr-rebase/SKILL.md) | Rebase onto latest `origin/develop`, resolve conflicts, and force-push with lease. |
| [`pr-restack`](skills/pull-requests/pr-restack/SKILL.md) | Rebase dependent PR stacks and repoint downstream branches to correct bases. |

### Issues

| Skill | Description |
| --- | --- |
| [`issue-create`](skills/issues/issue-create/SKILL.md) | Create a GitHub issue from context and optional metadata. |

### Code quality

| Skill | Description |
| --- | --- |
| [`deep-review`](skills/code-quality/deep-review/SKILL.md) | Strict maintainability review focused on abstractions, oversized files, and condition sprawl. |
| [`dry`](skills/code-quality/dry/SKILL.md) | Read-only DRY review that ranks duplication and proposes concrete consolidations. |
| [`principles`](skills/code-quality/principles/SKILL.md) | Apply core design principles through a concise implementation/review checklist. |
| [`sniff`](skills/code-quality/sniff/SKILL.md) | Run smell analysis and map findings to canonical smells and refactor options. |
| [`fresh-air`](skills/code-quality/fresh-air/SKILL.md) | Recommend best-fit refactoring techniques for smell findings with confidence. |
| [`refactor`](skills/code-quality/refactor/SKILL.md) | Orchestrate smell validation, technique selection, and final implementation planning. |

### Skill authoring (project skills)

| Skill | Description |
| --- | --- |
| [`check-skill-name`](.agents/skills/check-skill-name/SKILL.md) | Check skill names for collisions and return CLEAR/CONFLICT/RISKY plus safe alternatives. |
| [`make-skill`](.agents/skills/make-skill/SKILL.md) | Plan and scaffold a convention-compliant repo skill, including name validation. |

## Agents

Claude Code subagents for focused delegated work.

| Agent | Description |
| --- | --- |
| [`code-reviewer`](agents/code-reviewer.md) | Review diffs for correctness bugs/regressions and report ranked findings with `file:line`. Read-only. |
