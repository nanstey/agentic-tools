# Agentic tools

Reusable tools I use to do real engineering work, shared across machines and
projects.

| Tool Type | Description |
| --- | --- |
| **Skills** | Small, self-contained `SKILL.md` workflows that teach a coding agent how to run one task reliably, end-to-end. Portable across harnesses. |
| **Agent profiles** | Claude Code subagents I can delegate focused work to. |

They're designed to be composable and easy to adapt.

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

Everyday local version-control workflows — no PR or `gh` required.

| Skill | Description |
| --- | --- |
| [`changes`](skills/dev/changes/SKILL.md) | Inspect the current staged and unstaged changes and summarize them as logical groupings, using the branch history for context and flagging anything unrelated, incidental, or problematic. Read-only; hands off to `commit` when you're ready. |
| [`build`](skills/dev/build/SKILL.md) | Implement a scoped change from provided context, a plan, or a speclist: turn input into concrete tasks, apply code changes, validate, and report assumptions, outcomes, and follow-ups. |
| [`commit`](skills/dev/commit/SKILL.md) | Turn the current working-tree changes into well-formed commit(s): review the diff, group related changes, write a message in the repo's convention, run pre-commit hooks, then push to `origin` by default (unless asked not to). |
| [`rebase`](skills/dev/rebase/SKILL.md) | Rebase the current branch onto the latest base (`main` or `develop`): fetch, rebase, hand off to `conflicts` automatically on conflict, then `--force-with-lease`. The PR-agnostic sibling of `pr-rebase`. |
| [`conflicts`](skills/dev/conflicts/SKILL.md) | Resolve an in-progress merge/rebase/cherry-pick/revert conflict state using branch intent, then continue the operation to completion. Auto-triggered by `rebase`. |
| [`speclist`](skills/dev/speclist/SKILL.md) | Turn a report (analysis, findings, review notes, postmortem, discovery write-up) into an execution-ready implementation-spec checklist: extract requirements, sequence work, surface blockers, and define validation and rollout checks. |

### Pull Requests

Skills for keeping branches and PRs healthy on GitHub. They default to `gh`,
discover the PR from the current branch, and treat `CLAUDE.md` / `AGENTS.md` as
the source of truth.

| Skill | Description |
| --- | --- |
| [`pr-info`](skills/pull-requests/pr-info/SKILL.md) | Discover and verify the single PR for the current branch (or a provided URL) and load its metadata, applying the standard gates for missing, duplicate, mismatched, or closed PRs. Read-only; the shared front-door step the other `pr-*` skills call first. |
| [`pr-ci`](skills/pull-requests/pr-ci/SKILL.md) | Investigate and fix failed PR CI jobs end-to-end: discover the PR, read failed-job logs, deduplicate failures by root cause, fix the code, validate, commit, and push. |
| [`pr-comments`](skills/pull-requests/pr-comments/SKILL.md) | Address unresolved PR review comments end-to-end: triage each thread, make worthwhile changes, validate, commit, push, then reply to or resolve every thread. |
| [`pr-description`](skills/pull-requests/pr-description/SKILL.md) | Refresh a PR description so it matches the current changeset: analyze drift against the base branch, rewrite sections concisely, maintain checklists, and update the body via `gh`. |
| [`pr-rebase`](skills/pull-requests/pr-rebase/SKILL.md) | Rebase the current branch onto the latest `origin/develop`, resolve conflicts using branch intent and the PR description, then force-push with lease. |
| [`pr-restack`](skills/pull-requests/pr-restack/SKILL.md) | Re-align a stack of dependent branches/PRs after upstream branches drift, rebase, force-push, or merge - re-pointing each downstream branch at its correct base while preserving its own commits. |

### Issues

| Skill | Description |
| --- | --- |
| [`issue-create`](skills/issues/issue-create/SKILL.md) | Create a GitHub issue from provided context, apply optional metadata. |

### Code quality

| Skill | Description |
| --- | --- |
| [`deep-review`](skills/code-quality/deep-review/SKILL.md) | An extremely strict maintainability review focused on abstraction quality, giant files, and spaghetti-condition growth, pushing for ambitious "code judo" restructurings over local cleanups. Manually invoked (`disable-model-invocation`). Complements the bug-hunting `code-reviewer` agent. |
| [`dry`](skills/code-quality/dry/SKILL.md) | Read-only hunt for code duplication, DRY violations, and simplification opportunities over a chosen scope, ranking findings and proposing concrete consolidations - including new small reusable files. Distinguishes true duplication from incidental similarity that should stay separate. Hand off to `simplify` to apply. |
| [`principles`](skills/code-quality/principles/SKILL.md) | Remind the agent to apply core software design principles during design, implementation, and review with a concise checklist that explains meaning, applies context, and good-vs-bad reference patterns. |
| [`sniff`](skills/code-quality/sniff/SKILL.md) | Run a structured code-smell review backed by `sniff`'s local smell hierarchy (`./smells/index.json` + per-smell markdown), then return evidence-backed canonical mappings and related refactorings. |
| [`fresh-air`](skills/code-quality/fresh-air/SKILL.md) | Analyze one or more canonical smell findings and recommend best-fit primary (plus optional fallback) refactoring techniques with concrete code-improvement suggestions and confidence, using `fresh-air`'s local smell/technique datasets. |
| [`refactor`](skills/code-quality/refactor/SKILL.md) | Orchestrate smell-to-plan flow: validate findings, fan out one smell at a time to `fresh-air` when needed, aggregate recommendations, and author a final implementation plan. |

### Skill authoring (project skills)

These are repo-scoped authoring helpers under `.agents/skills/`. The repo also
symlinks `.claude` to `.agents`, so Claude resolves the same files via
`.claude/skills/` without duplicating content.

| Skill | Description |
| --- | --- |
| [`check-skill-name`](.agents/skills/check-skill-name/SKILL.md) | Check a proposed skill name against reserved built-in commands and bundled skills from Claude Code, Codex, and Cursor (plus names already in this repo), and report CLEAR / CONFLICT / RISKY with non-conflicting alternatives. Conflicts come from a local `known-names.json` that an update mode refreshes from each tool's docs. |
| [`make-skill`](.agents/skills/make-skill/SKILL.md) | Create a new repo-native skill end-to-end: plan first, state assumptions, ask focused clarifying questions, validate the name with `check-skill-name`, then scaffold a convention-compliant `SKILL.md` and catalog entry. |

## Agents

Claude Code subagents for focused, delegable work.

| Agent | Description |
| --- | --- |
| [`code-reviewer`](agents/code-reviewer.md) | Reviews a code change (working-tree diff, staged diff, or a commit range) for correctness bugs, regressions, and clear quality problems, then reports findings ranked by severity with `file:line` references. Read-only. |
