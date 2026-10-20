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

Install or update skills, agents and harness configuration, then report external-tool status:
```sh
bash install.sh
```

External-tool installation requires an explicit action:
```sh
./install.sh --tools
./install.sh --tool gh
bash install.sh --help
```

Use one action at a time. Help does not install or check anything.
Invalid arguments and unknown tool names fail before bootstrap or `.env` execution.
Explicit tool failures return nonzero after the status report.
The installer forwards `TOOLS_SKIP` and `TOOLS_INTERACTIVE` to the tools CLI.
Missing tools add one root installation suggestion without changing default success.
See [Tool Installation](install/TOOL_INSTALLATION.md#root-installer-integration) for the full contract.

`install.sh` calls [`install/main.sh`](install/main.sh), the only runtime file directly under `install/`.
The [installation guide](install/TOOL_INSTALLATION.md) is the documentation exception.
Definition modules live in [`install/modules/`](install/modules/).
External CLI installers and their usage live in [`install/tools/`](install/tools/README.md).
Run `bash install/tests/install.test.sh` for offline installer regression tests.

## Harnesses

`harness/` stores portable, non-secret configuration for supported agent
harnesses. Expand a harness below for its managed files, install destinations,
and runtime behavior.

<details>
<summary><code>harness/pi/</code> (Pi)</summary>

`install.sh` copies Pi configuration into `$PI_AGENT_DIR` (default `~/.pi/agent`) and patches installed Pi packages. See [`harness/pi/README.md`](harness/pi/README.md) for the managed-file table, third-party package patches, the self-improvement loop, `pi-secret`, and machine bootstrap.

</details>

<details>
<summary><code>harness/omp/</code> (OMP)</summary>

`install.sh` links skills and agents into `~/.omp/agent`, copies portable OMP config, applies the status-line settings, and installs OMP packages. See [`harness/omp/README.md`](harness/omp/README.md) for the managed-file table and behavior.

</details>

## Skills

### Dev

| Skill | Description |
| --- | --- |
| [`git`](skills/dev/git/SKILL.md) | Runs everyday git workflows from one command — branching, worktrees, change review, commits, rebasing and conflict resolution. Use when work needs a branch or worktree, changes need grouping or committing, a branch needs rebasing, or a stopped merge/rebase has conflicts. |
| [`pr`](skills/dev/pr/SKILL.md) | Runs PR creation, maintenance, and stacked-PR workflows from one command. Use when a branch or pull request needs creation, reconciliation, remediation, publication, merge, or stack management. |

### Env

| Skill | Description |
| --- | --- |
| [`worktree-env`](skills/env/worktree-env/SKILL.md) | Builds a project-specific, idempotent worktree bootstrap that copies approved local configuration, installs dependencies, and allocates collision-free service ports. Use when a repository needs repeatable isolated development environments for Git or Orca worktrees. |
| [`new-app`](skills/env/new-app/SKILL.md) | Scaffolds a new local software project from scratch — folder structure, git, README, LICENSE, .gitignore, optional CI, and a first commit — delegating language-specific init to the ecosystem's own tool. Use when starting a brand-new local application. |
| [`new-repo`](skills/env/new-repo/SKILL.md) | Creates and configures a private GitHub repository for an existing local git project, including protected-main and squash-only policy. Use when a local repository needs a GitHub remote. |
| [`orca-repo`](skills/env/orca-repo/SKILL.md) | Registers an existing local git repository with the Orca IDE and verifies it is tracked, optionally setting its base ref. Use when a local repository should appear in Orca. |
| [`handoff`](skills/env/handoff/SKILL.md) | Hands a task off to a new standalone Pi session in a fresh Orca worktree that drives it to review-ready PRs with idea-to-pr, then stops work on it. Use when the user asks to run, continue, or give a task in a new worktree or to another agent. |

### Planning

Focused planning skills below are optional and independently selectable; `proposal` and `speclist` remain separate planning paths. `plan-init` groups a change's artifacts into one plan folder with a README index that later skills and `build` share.

| Skill | Description |
| --- | --- |
| [`plan-init`](skills/planning/plan-init/SKILL.md) | Creates a plan folder with a README index so a change's planning artifacts and per-slice specs live together and stay linked. Use when starting planning that will produce multiple related documents or feed a build. |
| [`proposal`](skills/planning/proposal/SKILL.md) | Runs discovery and uncertainty resolution for a change, then writes one self-contained plan document covering purpose, behaviour, validation, architecture, and phased vertical slices. Use for a small or trivial change simple enough to plan in a single document rather than decomposed focused artifacts. |
| [`speclist`](skills/planning/speclist/SKILL.md) | Convert reports into ordered implementation checklists with blockers and validation steps. |
| [`product-review`](skills/planning/product-review/SKILL.md) | Turns a product request into a concise user-centred review with outcomes, success signals, and scope. Use when an agent misunderstanding the product intent would be expensive. |
| [`system-architecture`](skills/planning/system-architecture/SKILL.md) | Produces a bounded system architecture artifact covering boundaries, contracts, and data flow. Use when a change crosses components or carries consequential technical design choices. |
| [`program-design`](skills/planning/program-design/SKILL.md) | Produces a concise code-shape design with call paths, file placement, and key interfaces. Use when an implementation could go wrong despite a settled architecture or local requirement. |
| [`vertical-slices`](skills/planning/vertical-slices/SKILL.md) | Breaks a change into small observable implementation increments with verification checkpoints. Use when a plan risks becoming a large horizontal batch of layer-by-layer work. |

### Workflow

| Skill | Description |
| --- | --- |
| [`idea-to-pr`](skills/workflow/idea-to-pr/SKILL.md) | Takes an idea from evidence-backed discovery through built, tested, and validated pull requests. Use when a feature idea or change request should be driven end-to-end to review-ready PRs. |
| [`flow-design`](skills/workflow/flow-design/SKILL.md) | Designs a platform-neutral delegation plan with roles, gates, and return contracts. Use when a task needs coordinated execution designed before work begins. |
| [`build`](skills/workflow/build/SKILL.md) | Implements scoped changes from context, plans, or speclists through verifiable phases with up-front success criteria and per-phase validation. Use when execution should start from existing requirements. |

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
| [`write-docs`](skills/writing/write-docs/SKILL.md) | Write clear, precise project documentation that describes behaviour and relationships in plain language. |
| [`deslop`](skills/writing/deslop/SKILL.md) | Remove AI writing patterns, tells, and formulaic slop from prose. |
| [`bluf`](skills/writing/bluf/SKILL.md) | Structure a message bottom-line-first, stating the main point or request before its supporting context. |
| [`prep`](skills/writing/prep/SKILL.md) | Structure a persuasive case as Point, Reason, Example, Point so a recommendation lands with evidence. |
| [`grow`](skills/writing/grow/SKILL.md) | Structure current-to-future planning as Goal, Reality, Options, Will to bridge a current state to a target. |
| [`observation-impact-question`](skills/writing/observation-impact-question/SKILL.md) | Structure lightweight feedback as Observation, Impact, Question to stay specific and non-accusatory. |
| [`before-after-bridge`](skills/writing/before-after-bridge/SKILL.md) | Structure a results story as Before, After, Bridge so a demo or outcome leads with impact. |
| [`ste`](skills/writing/ste/SKILL.md) | Rewrite dense or ambiguous English into ASD-STE100 Simplified Technical English so a machine or non-native reader cannot misparse it. |

### Visual

| Skill | Description |
| --- | --- |
| [`visual-capture`](skills/visual/visual-capture/SKILL.md) | Capture screenshots and videos of a running site (before/after PR evidence, component crops, multi-page or scroll tours) by driving the `playwright-cli` tool. |
| [`prototype`](skills/visual/prototype/SKILL.md) | Build a throwaway prototype (interactive logic TUI or switchable UI variants) to answer a design question, then capture the answer and delete it. |

### Tools

| Skill | Description |
| --- | --- |
| [`playwright-cli`](skills/tools/playwright-cli/SKILL.md) | Drive a browser from the CLI — navigate, interact, snapshot, screenshot, record video, mock network, and run/generate Playwright tests. Vendored from `microsoft/playwright-cli` (Apache-2.0). |
| [`chrome-devtools-cli`](skills/tools/chrome-devtools-cli/SKILL.md) | Automate browser tasks and use Chrome DevTools from the CLI. Vendored from `ChromeDevTools/chrome-devtools-mcp` (Apache-2.0). |
| [`typesafe-ai`](skills/tools/typesafe-ai/SKILL.md) | Build AI-powered software with TypeSafe System One models (Jev): typed judgments and probabilities from natural language and app state that code composes for routing, ranking, extraction, and verification. Vendored from `typesafe-ai/skills` (MIT). |
| [`jev-ultrafast`](skills/tools/jev-ultrafast/SKILL.md) | Runs Jev Ultrafast through its pinned browser agent and verifies the requested page outcome. Use when a Chrome task benefits from its dynamic indexed action space. Upstream: `browser-use/jev-ultrafast` 0.1.0 at `1231850a0bf1a0c0341fe408ef1668dbbfdfac46` (MIT). |
| [`agent-browser`](skills/tools/agent-browser/SKILL.md) | Fast headless browser testing and screenshots — a native Rust CLI and persistent daemon driving Chrome over CDP, with accessibility-tree snapshots addressed by compact `@eN` refs and snapshot/screenshot diffing. Upstream: `vercel-labs/agent-browser` (Apache-2.0). |

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
| [`scrutiny`](skills/code-quality/scrutiny/SKILL.md) | Silently interrogates a build/design across the relevant engineering domains, self-answering what the codebase and defaults allow and escalating only authority decisions, then builds and verifies. Vendored and adapted from [m4vic/socratic](https://github.com/m4vic/socratic) (MIT). |
| [`ponytail`](skills/code-quality/ponytail/SKILL.md) | Tightens the current branch's changes to the fewest lines that still work, climbing the YAGNI/reuse/stdlib/native ladder on every changed hunk, plus a repo-wide audit mode. Vendored and adapted from [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT). |

### Authoring (project skills)

| Skill | Description |
| --- | --- |
| [`check-skill-name`](.agents/skills/check-skill-name/SKILL.md) | Check skill names for collisions and return CLEAR/CONFLICT/RISKY plus safe alternatives. |
| [`pi-sync`](.agents/skills/pi-sync/SKILL.md) | Capture portable, non-secret pi config from a live `~/.pi/agent` into `harness/pi/` and commit it, without touching secrets. |
| [`make-skill`](.agents/skills/make-skill/SKILL.md) | Plan and scaffold a convention-compliant repo skill, including name validation. |
| [`make-agent`](.agents/skills/make-agent/SKILL.md) | Plan and scaffold a convention-compliant repo agent profile and align the catalog. |

## Agents

Subagent profiles for focused delegated work. Every profile is a leaf agent that
never spawns further agents. Pi-specific runtime details are under
[Pi agent profiles](#pi-agent-profiles) in the Pi harness section.

| Agent | Model | Description |
| --- | --- | --- |
| [`worker`](agents/worker.md) | `openai-codex/gpt-5.6-terra` | Implementation agent for normal tasks and approved plans. Single writer thread; escalates unapproved decisions via `caller_ping`. |
| [`scout`](agents/scout.md) | `anthropic/claude-haiku-5-5` | Fast codebase recon that returns compressed context for handoff. Writes `context.md`. |
| [`researcher`](agents/researcher.md) | `anthropic/claude-sonnet-5-5` | Autonomous web researcher — searches, evaluates, and synthesizes a focused research brief into `research.md`. |
| [`planner`](agents/planner.md) | `anthropic/claude-sonnet-5-5` | Creates concrete implementation plans from context and requirements. Read-only; writes `plan.md`. |
| [`reviewer`](agents/reviewer.md) | `anthropic/claude-sonnet-5-5` | Versatile review specialist for code diffs, plans, proposed solutions, codebase health, and PR/issue validation. |

Model routing: Anthropic handles reading, research, planning, and review. OpenAI handles
implementation and independent judgment. Ordinary subagent work starts at standard tier
and medium thinking. Premium and `xhigh` require direct exception evidence and a recorded
reason. Low classifier confidence does not cause escalation. The parent selects a reviewer
from the other model family at the same tier and passes an explicit `model:thinking` suffix.
See [`harness/pi/APPEND_SYSTEM.md`](harness/pi/APPEND_SYSTEM.md) for routing and fallback rules.
The main agent stays on the user's selected model unless provider/failure fallback is needed.
