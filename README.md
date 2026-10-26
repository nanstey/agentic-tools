# Agentic tools

Reusable tools for real engineering work across machines and projects.

| Tool Type | Description |
| --- | --- |
| **Skills** | Portable `SKILL.md` workflows for reliable end-to-end tasks. |
| **Agent types** | Pi Lite delegated-agent types with fixed model and thinking tiers. |

## Quick Start

Clone the repo:
```sh
git clone git@github.com:nanstey/agentic-tools.git
```

Install or update skills, Pi-only Lite agent types, and harness configuration, then report external-tool status:
```sh
bash install.sh
```

External-tool installation requires an explicit action:
```sh
./install.sh --tools
./install.sh --tool gh
bash install.sh --help
```

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

`install.sh` links skills into `~/.omp/agent`, copies portable OMP config, applies the status-line settings, and installs OMP packages. The Lite agent types are Pi-only. See [`harness/omp/README.md`](harness/omp/README.md) for the managed-file table and behavior.

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

### Planning

`planning` sizes a change and composes the skills below; they stay usable on their own. Focused planning skills are optional and independently selectable; `proposal` and `speclist` remain separate planning paths. `plan-init` groups a change's artifacts into one plan folder with a README index that later skills and `build` share.

| Skill | Description |
| --- | --- |
| [`plan-dir`](skills/planning/plan-dir/SKILL.md) | Resolves the base directory where a repository keeps plans, proposals, and design docs, by investigating the repo rather than assuming a path. Use when a planning skill must decide where to write or find plan folders. |
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
| [`review-code`](skills/workflow/review-code/SKILL.md) | Produces one source-verified review packet with optional fix planning or working-tree remediation. Use when a changeset needs coordinated quality, refactor, and security review. |
| [`planning`](skills/workflow/planning/SKILL.md) | Plans a change end-to-end by sizing it and composing the focused planning skills it needs into one plan folder, from a single proposal up to the full product, architecture, design, slice, and spec chain. Use when a change needs a plan and the right depth of planning is not yet decided. |

### Agent

| Skill | Description |
| --- | --- |
| [`context-engineering`](skills/agent/context-engineering/SKILL.md) | Audit a scope (skill, system prompt, tool set, CLAUDE.md, project) against context engineering best practices and apply improvements. |
| [`scope`](skills/agent/scope/SKILL.md) | Confirm and normalize analysis scope, then return clear scope assumptions before scanning files. |
| [`reflect`](skills/agent/reflect/SKILL.md) | Review the current session for problems and their fixes, then propose durable improvements to repo skills, scripts, or docs that prevent recurrence. |
| [`handoff`](skills/agent/handoff/SKILL.md) | Hands a task off to a new standalone Pi session in a fresh Orca worktree that drives it to review-ready PRs with idea-to-pr, then stops work on it. Use when the user asks to run, continue, or give a task in a new worktree or to another agent. |
| [`durable`](skills/agent/durable/SKILL.md) | Operates the Durable local agent engine through its CLI. Use when checking, attaching to, chatting with, queueing, stopping, or approving Durable work. |

### Writing

| Skill | Description |
| --- | --- |
| [`terse`](skills/writing/terse/SKILL.md) | Keep responses concise, outcome-first, and high signal. |
| [`concise`](skills/writing/concise/SKILL.md) | Sets clear, concise, actionable communication patterns, reference codes, and scope boundaries. Use when responses should be plain and tightly scoped. |
| [`write-docs`](skills/writing/write-docs/SKILL.md) | Write clear, precise project documentation that describes behaviour and relationships in plain language. |
| [`deslop`](skills/writing/deslop/SKILL.md) | Remove AI writing patterns, tells, and formulaic slop from prose. |
| [`bluf`](skills/writing/bluf/SKILL.md) | Structure a message bottom-line-first, stating the main point or request before its supporting context. |
| [`prep`](skills/writing/prep/SKILL.md) | Structure a persuasive case as Point, Reason, Example, Point so a recommendation lands with evidence. |
| [`grow`](skills/writing/grow/SKILL.md) | Structure current-to-future planning as Goal, Reality, Options, Will to bridge a current state to a target. |
| [`observation-impact-question`](skills/writing/observation-impact-question/SKILL.md) | Structure lightweight feedback as Observation, Impact, Question to stay specific and non-accusatory. |
| [`before-after-bridge`](skills/writing/before-after-bridge/SKILL.md) | Structure a results story as Before, After, Bridge so a demo or outcome leads with impact. |
| [`ste`](skills/writing/ste/SKILL.md) | Rewrite dense or ambiguous English into ASD-STE100 Simplified Technical English so a machine or non-native reader cannot misparse it. |
| [`ask-a-pro`](skills/writing/ask-a-pro/SKILL.md) | Rewrites a user's prompt into a deeper version of the same task, shaped by what a top professional in the field would do. Use when a prompt should get more depth rather than more scope, or when asked to "ask a pro" or pressure-test a prompt before running it. |

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
| [`bugs`](skills/code-quality/bugs/SKILL.md) | Hunts functional defects in code, a diff, or a repository by tracing real execution paths, challenging each suspect, and reporting only bugs with a concrete trigger, evidence, and suggested fix. Use when asked to find bugs, hunt defects, audit logic or runtime correctness, or check changed code for errors that tests may miss. |
| [`risk-review`](skills/code-quality/risk-review/SKILL.md) | Produces an evidence-led, read-only change review with impact paths, required checks, and verified findings. Use when reviewing a change or supplying a shared quality or security review packet. |
| [`verification`](skills/code-quality/verification/SKILL.md) | Verifies the basic claims of a changeset by seeking executed evidence that the change achieved its stated goal. Use when a change, branch, or diff claims an outcome and that claim needs proof before it is trusted. |
| [`refactor`](skills/code-quality/refactor/SKILL.md) | Reviews and fixes code smells, duplication (DRY), responsibilities (SRP), design principles, structural maintainability, over-engineering, and technique selection. Use when exhaustive review, simplification, extraction, deep review, or refactor planning should lead to behavior-preserving fixes, or diagnosis only with --report. |
| [`complexity`](skills/code-quality/complexity/SKILL.md) | Measures cyclomatic complexity, function length, and parameter count on code with Lizard, then judges whether code needs refactoring. Use when self-assessing code you wrote or changed, deciding if a refactor is warranted, or finding the most complex functions in a scope. |
| [`security`](skills/code-quality/security/SKILL.md) | Reviews code, a diff, or a repository for exploitable security flaws by tracing attacker-controlled input to dangerous sinks, then reports verified findings with severity, confidence, and suggested fixes. Use when asked to security-review, audit, or check code for vulnerabilities, secrets, unsafe dependencies, or weak auth, or after changes to auth, input handling, secrets, or trust boundaries. |
| [`scrutiny`](skills/code-quality/scrutiny/SKILL.md) | Silently interrogates a build/design across the relevant engineering domains, self-answering what the codebase and defaults allow and escalating only authority decisions, then builds and verifies. Vendored and adapted from [m4vic/socratic](https://github.com/m4vic/socratic) (MIT). |

Refactor's internal simplification method is vendored and adapted from
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)
([MIT license](skills/code-quality/refactor/references/simplify.LICENSE)).

### Authoring (project skills)

| Skill | Description |
| --- | --- |
| [`check-skill-name`](.agents/skills/check-skill-name/SKILL.md) | Check skill names for collisions and return CLEAR/CONFLICT/RISKY plus safe alternatives. |
| [`pi-sync`](.agents/skills/pi-sync/SKILL.md) | Capture portable, non-secret pi config from a live `~/.pi/agent` into `harness/pi/` and commit it, without touching secrets. |
| [`make-skill`](.agents/skills/make-skill/SKILL.md) | Plan and scaffold a convention-compliant repo skill, including name validation. |
| [`make-agent`](.agents/skills/make-agent/SKILL.md) | Creates Lite agent types from plan to scaffolded `agents/<name>.md` and catalog alignment. Use when adding a Pi agent type to this repository. |

## Agents

Pi-only Lite agent types for focused delegated work. `install.sh` links them only into Pi, not Claude or OMP. Every type is a leaf agent that never spawns further agents. Pi-specific runtime details are under [Pi agent types](harness/pi/README.md#pi-agent-types).

| Agent | Model and thinking | Description |
| --- | --- | --- |
| [`scout-quick`](agents/scout-quick.md) | `anthropic/claude-haiku-5-5`, low | Fast codebase reconnaissance (quick tier: bounded mechanical task). Delegate when focused implementation context is needed. |
| [`scout-standard`](agents/scout-standard.md) | `anthropic/claude-sonnet-5-5`, medium | Fast codebase reconnaissance (standard tier: ordinary work). Delegate when focused implementation context is needed. |
| [`scout-high`](agents/scout-high.md) | `anthropic/claude-sonnet-5-5`, high | Fast codebase reconnaissance (high tier: cross-boundary or high-blast-radius work). Delegate when focused implementation context is needed. |
| [`scout-premium`](agents/scout-premium.md) | `anthropic/claude-sonnet-5-5`, high | Fast codebase reconnaissance (premium tier: explicitly requested or indivisible irreversible or security-critical work). Delegate when focused implementation context is needed. |
| [`researcher-quick`](agents/researcher-quick.md) | `anthropic/claude-haiku-5-5`, low | Focused web research (quick tier: bounded mechanical task). Delegate when sourced external evidence is needed. |
| [`researcher-standard`](agents/researcher-standard.md) | `anthropic/claude-sonnet-5-5`, medium | Focused web research (standard tier: ordinary work). Delegate when sourced external evidence is needed. |
| [`researcher-high`](agents/researcher-high.md) | `anthropic/claude-sonnet-5-5`, high | Focused web research (high tier: cross-boundary or high-blast-radius work). Delegate when sourced external evidence is needed. |
| [`researcher-premium`](agents/researcher-premium.md) | `anthropic/claude-opus-5-5`, high | Focused web research (premium tier: explicitly requested or indivisible irreversible or security-critical work). Delegate when sourced external evidence is needed. |
| [`planner-quick`](agents/planner-quick.md) | `anthropic/claude-sonnet-5-5`, low | Concrete implementation planning (quick tier: bounded mechanical task). Delegate when requirements must become an actionable plan. |
| [`planner-standard`](agents/planner-standard.md) | `anthropic/claude-sonnet-5-5`, medium | Concrete implementation planning (standard tier: ordinary work). Delegate when requirements must become an actionable plan. |
| [`planner-high`](agents/planner-high.md) | `anthropic/claude-sonnet-5-5`, high | Concrete implementation planning (high tier: cross-boundary or high-blast-radius work). Delegate when requirements must become an actionable plan. |
| [`planner-premium`](agents/planner-premium.md) | `anthropic/claude-fable-5-1`, high | Concrete implementation planning (premium tier: explicitly requested or indivisible irreversible or security-critical work). Delegate when requirements must become an actionable plan. |
| [`worker-quick`](agents/worker-quick.md) | `openai-codex/gpt-6-luna`, low | Narrow implementation work (quick tier: bounded mechanical task). Delegate when an approved task needs one writer. |
| [`worker-standard`](agents/worker-standard.md) | `openai-codex/gpt-5.6-terra`, medium | Narrow implementation work (standard tier: ordinary work). Delegate when an approved task needs one writer. |
| [`worker-high`](agents/worker-high.md) | `openai-codex/gpt-5.6-terra`, high | Narrow implementation work (high tier: cross-boundary or high-blast-radius work). Delegate when an approved task needs one writer. |
| [`worker-premium`](agents/worker-premium.md) | `openai-codex/gpt-6.1-sol`, high | Narrow implementation work (premium tier: explicitly requested or indivisible irreversible or security-critical work). Delegate when an approved task needs one writer. |
| [`reviewer-openai-quick`](agents/reviewer-openai-quick.md) | `anthropic/claude-haiku-5-5`, low | Independent Anthropic review of OpenAI-produced work (quick tier: bounded mechanical task). Delegate when OpenAI work needs review. |
| [`reviewer-openai-standard`](agents/reviewer-openai-standard.md) | `anthropic/claude-sonnet-5-5`, medium | Independent Anthropic review of OpenAI-produced work (standard tier: ordinary work). Delegate when OpenAI work needs review. |
| [`reviewer-openai-high`](agents/reviewer-openai-high.md) | `anthropic/claude-sonnet-5-5`, high | Independent Anthropic review of OpenAI-produced work (high tier: cross-boundary or high-blast-radius work). Delegate when OpenAI work needs review. |
| [`reviewer-openai-premium`](agents/reviewer-openai-premium.md) | `anthropic/claude-opus-5-5`, high | Independent Anthropic review of OpenAI-produced work (premium tier: explicitly requested or indivisible irreversible or security-critical work). Delegate when OpenAI work needs review. |
| [`reviewer-anthropic-quick`](agents/reviewer-anthropic-quick.md) | `openai-codex/gpt-6-luna`, low | Independent OpenAI review of Anthropic-produced work (quick tier: bounded mechanical task). Delegate when Anthropic work needs review. |
| [`reviewer-anthropic-standard`](agents/reviewer-anthropic-standard.md) | `openai-codex/gpt-5.6-terra`, medium | Independent OpenAI review of Anthropic-produced work (standard tier: ordinary work). Delegate when Anthropic work needs review. |
| [`reviewer-anthropic-high`](agents/reviewer-anthropic-high.md) | `openai-codex/gpt-5.6-terra`, high | Independent OpenAI review of Anthropic-produced work (high tier: cross-boundary or high-blast-radius work). Delegate when Anthropic work needs review. |
| [`reviewer-anthropic-premium`](agents/reviewer-anthropic-premium.md) | `openai-codex/gpt-6.1-sol`, high | Independent OpenAI review of Anthropic-produced work (premium tier: explicitly requested or indivisible irreversible or security-critical work). Delegate when Anthropic work needs review. |

Jev selects the tier; frontmatter pins its primary model and thinking. On provider failure
Lite can use `pi-fallback-models`' configured global chain, which does not guarantee the table's
fallback arrow or reviewer-family independence. See [`harness/pi/APPEND_SYSTEM.md`](harness/pi/APPEND_SYSTEM.md)
for the dispatch, fallback, and provenance rules.
