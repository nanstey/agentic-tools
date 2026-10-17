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

## Harnesses

`harness/` stores portable, non-secret configuration for supported agent
harnesses. Expand a harness below for its managed files, install destinations,
and runtime behavior.

<details>
<summary><code>harness/pi/</code> (Pi)</summary>

`install.sh` copies the Pi configuration into `$PI_AGENT_DIR`, which defaults to
`~/.pi/agent` and follows `PI_CODING_AGENT_DIR` when set. These files are copied
rather than symlinked because Pi may rewrite them locally.

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| `harness/pi/settings.json` | `$PI_AGENT_DIR/settings.json` | Pi defaults (including codemode) and extension package list, including `npm:pi-intercom@0.12.0`, `npm:pi-fallback-models@0.1.1`, `npm:pi-jev@0.7.0`, and `npm:@lazco/pi-rich-model-selector@0.7.0` (replaces `/models` with a picker that shows context size, price, thinking levels, and key state; star models with `Ctrl+R` inside the picker, rebind with `/models bind star <key>`); `-jev_find_tools` removes the redundant tool router. |
| `harness/pi/pi-jev-auto.conf` | `~/.config/environment.d/91-pi-jev-auto.conf` | Enables Jev auto routing/skills, thinking, and tool guard; disables auto-model (`PI_JEV_AUTO_MODEL=0`), agent dispatch (`PI_JEV_AGENTS=0`), and compaction (`PI_JEV_COMPACT=0`, pi-jev 0.7.0 drops context) for Linux/systemd user sessions. `install.sh` copies this config when Pi is installed. The variables are user-wide, so OMP's pinned `pi-jev` also reads `PI_JEV_AUTO=1` and routes its prompts through Jev. |
| `harness/pi/APPEND_SYSTEM.md` | `$PI_AGENT_DIR/APPEND_SYSTEM.md` | Appends Pi prompt instructions, including the Orca worktree and Pi subagent rule. |
| `harness/pi/patches/pi-jev.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/` (`src/jev.ts`, `extensions/index.ts`) | Unified diff that `install.sh` applies to `pi-jev`: rebuilds its SDK client on credential changes, adds `PI_JEV_API_KEY`, and disables auto-thinking in subagents. Not copied. |
| `harness/pi/patches/pi-jev-prompt-guard.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/` (`src/thinking.ts`, `extensions/index.ts`) | Unified diff that `install.sh` applies to `pi-jev`: tolerates a missing `event.prompt` (runs started by `sendCustomMessage`, such as subagent results) instead of throwing `Cannot read properties of undefined (reading 'trim')`. Not copied. |
| `harness/pi/extensions/*.json` | `$PI_AGENT_DIR/extensions/` | Per-extension config. |
| `harness/pi/extensions/profile-secrets.ts` | `$PI_AGENT_DIR/extensions/profile-secrets.ts` | Exports the `NAME=value` secrets in `secrets/<profile>.env` into the environment while that `@nanstey/pi-auth-profiles` profile is active; unset names revert to the inherited value. |
| `harness/pi/bin/pi-secret` | `$PI_AGENT_DIR/bin/pi-secret` | CLI to set, unset, and list per-profile secrets (`pi-secret -p work set TYPESAFE_API_KEY`). Prompts without echo; files are mode 600. `install.sh` also symlinks it to `~/.local/bin/pi-secret` so ordinary shells find it. Run `set` from a normal terminal, not inside Pi. |
| `harness/pi/extensions/jev-router-openrouter-fallback.ts` | `$PI_AGENT_DIR/extensions/jev-router-openrouter-fallback.ts` | When no `TYPESAFE_API_KEY` is set but the active profile has OpenRouter auth, sets `PI_JEV_API_KEY` and `PI_JEV_BASE_URL` so pi-jev's tools bill to OpenRouter's System One endpoint. Pi's native classifier never sees the OpenRouter key. A real TypeSafe key or an external `PI_JEV_*` value always wins. |
| `harness/pi/extensions/collapse-tools.ts` | `$PI_AGENT_DIR/extensions/collapse-tools.ts` | Collapses tool output after all `session_start` handlers run, overriding `pi-diff`'s default of expanding it. |
| `harness/pi/extensions/pi-fallback.json` | `$PI_AGENT_DIR/extensions/pi-fallback.json` | Global model fallback chain for `pi-fallback-models`: `openai-codex/gpt-6.1-sol`, then `anthropic/claude-sonnet-5-5`, tried when the current model hits a quota, rate-limit, or provider error. |
| `harness/pi/extensions/pi-interactive-subagents/config.json` | `$PI_AGENT_DIR/extensions/pi-interactive-subagents/config.json` | Interactive-subagents config: mux settings plus `allowSubagentSpawning` and `subagentExtensions` (`pi-web-access`, `pi-fallback-models`), which package 3.10.1 ignores; children inherit installed extensions and agent profiles deny spawning via `deny-tools`. Kept for older package versions. |
| `harness/pi/extensions/pi-extensions-i18n/config.json` | `$PI_AGENT_DIR/extensions/pi-extensions-i18n/config.json` | Locale for pi extension messages: `en-US`, because the library defaults to Chinese regardless of system locale. |
| `harness/pi/extensions/pi-intercom/config.json` | `$PI_AGENT_DIR/intercom/config.json` | Shared pi-intercom config: enabled inbound replies, no send confirmation, and reply hints. |
| `harness/pi/command-shortcuts.json` | `$PI_AGENT_DIR/command-shortcuts.json` | Command shortcut bindings. |
| `harness/pi/keybindings.json` | `$PI_AGENT_DIR/keybindings.json` | Custom keybindings. |
| `harness/pi/sleek.json` | `$PI_AGENT_DIR/sleek.json` | sleek-ui settings: side panel off (`sleek-sidePanel: false`). sleek-ui hardcodes `~/.pi/agent/sleek.json`, so the copy only takes effect when `PI_AGENT_DIR` is the default. `install.sh` overwrites this file, so changes made with `/sleek` must be copied back here to persist. |
| `harness/pi/vendor/*.txt` | cloned to `$PI_AGENT_DIR/vendor/<host>/<path>` | Manifests of `<url> <full commit SHA>` lines (one repo per line) for git repos that Pi's `git:` source cannot install (monorepos with one extension package per subdirectory and no root manifest). `install.sh` clones each at its commit and fails if any clone is missing, because Pi silently skips a local package path that does not exist. `settings.json` lists the subdirectories as relative local packages. |
| `harness/pi/vendor/pr83-glitch-pi-extensions.txt` | `$PI_AGENT_DIR/vendor/github.com/pr83-glitch/Pr83-glitch-Pi-Extensions` | [Pr83-glitch Pi Extensions](https://github.com/pr83-glitch/Pr83-glitch-Pi-Extensions) at commit `d5fb0f6`. Loaded subdirectories: `sleek-ui` (themes, status bars, split-diff edit blocks, side panel on `Ctrl+\`, `/sleek` settings stored in `~/.pi/agent/sleek.json`) and `edit-message` (`Alt+E` or `/edit-message` to edit-and-regenerate, copy, or summarize-and-fork a previous user message; `Alt+R` or `/edit-message-name` to name the session). `modgate` is not loaded. |

The main agent stays on the user's selected model unless a provider/failure fallback is
needed. Context- and scale-based model selection applies only to subagent tasks.
Subagent tier and thinking come from a `codemode` `models.classify()` call (see `APPEND_SYSTEM.md`). After installation, start Pi from a
new login session so `environment.d` applies, or export `PI_JEV_AUTO_MODEL=0` in the
launching shell before restarting Pi. Remove any shell startup override that sets
`PI_JEV_AUTO_MODEL=1`; do not enable `--jev-auto-model` or `/jev auto-model on`.

When either Pi or OMP is installed, `install.sh` copies the same
`harness/pi/extensions/pi-intercom/config.json` source to
`$PI_AGENT_DIR/intercom/config.json`. pi-intercom also stores its runtime state
under `$PI_AGENT_DIR/intercom`.

Pi calls Jev through `codemode` (`models.classify()`); no extension is needed. The
classifier models offered depend on the credentials of the active auth profile, so set
per-profile keys with `pi-secret`:

- OpenRouter: `pi-secret -p work set OPENROUTER_API_KEY` (models `typesafe/jev-1.13`,
  `~typesafe/jev-latest`), or `/login` under that profile.
- TypeSafe direct: `pi-secret -p work set TYPESAFE_API_KEY` (model `jev-latest`).

The `profile-secrets` extension exports them while that profile is active. For a default key
shared by all profiles, copy `.env.example` to the git-ignored `.env`, set `TYPESAFE_API_KEY`, and
rerun `install.sh`; it writes the key with owner-only permissions to
`~/.pi/agent/secrets/typesafe_api_key` and `~/.config/environment.d/90-typesafe.conf`.
A stored `/login` credential outranks an environment variable for the same provider.

### Per-profile secrets (`pi-secret`)

`pi-secret [-p PROFILE] <command>` stores environment-variable secrets per
`@nanstey/pi-auth-profiles` profile in `~/.pi/agent/secrets/<profile>.env` (mode 600).
The `profile-secrets` extension exports them while that profile is active.
Run `pi-secret help` for the full reference.

| Command | Effect |
| --- | --- |
| `set NAME` | Store a secret. Prompts without echo, or reads one line from stdin. |
| `unset NAME` | Remove a secret. |
| `list` / `list --all` | List secret names (never values) for the profile / all profiles. |
| `profile` | Print the resolved profile. |

The profile is `-p PROFILE`, else the project's `authProfile`, else the global
`defaultProfile`, else `default`. Run `set` from a normal terminal, not inside Pi,
so the value stays out of the session transcript.

`install.sh` patches three installed third-party packages. Re-run it after Pi installs or updates
packages, because updates overwrite the patches. Each patch is idempotent. If upstream code
changed, it reports an error and leaves the file untouched, and `install.sh` finishes the other
installs and then exits 1.

- **`@maplezzk/pi-interactive-subagents`:** the child widget prints a "N denied" count for
  tools that are never registered. The patch keeps that list empty so the widget shows only
  available tools. Drop it once upstream makes the list optional.
- **`pi-fallback-models`:** 0.1.1 classifies Anthropic's "You're out of extra usage" 400 as
  ignorable, so no fallback happens on that quota error. The patch adds that phrase to its
  quota patterns. Drop it once upstream recognizes it.
- **`pi-jev`:** 0.7.0 builds its SDK client once, so a profile switch keeps the first profile's
  key and endpoint. `harness/pi/patches/pi-jev.patch` (a unified diff applied with `patch`)
  rebuilds the client when the resolved key or base URL changes, reads `PI_JEV_API_KEY` ahead of
  `TYPESAFE_API_KEY`, and skips auto-thinking in subagents so the model suffix stays in force.
  Drop it once upstream does.

Secrets and machine-local state (`auth.json`, `auth-profiles/`, `web-search.json`,
`trust.json`, sessions, run history) are git-ignored and never travel — re-auth
per machine with `/login`.

To pull live config changes back into the repo, use the [`pi-sync`](.agents/skills/pi-sync/SKILL.md)
skill (allowlist-based; it never reads or copies secrets).

### Pi agent profiles

The profiles under `agents/` are written for `@maplezzk/pi-interactive-subagents`
(frontmatter `system-prompt`, `interactive`, `deny-tools`). Every profile ends by calling
`subagent_done`: spawning tools are denied, and blockers go to the parent through
`caller_ping`. Profiles do not auto-create handoff files; the delegating agent names
output paths in the task.

### New machine bootstrap
```sh
git clone git@github.com:nanstey/agentic-tools.git ~/Code/skills
cd ~/Code/skills && bash install.sh   # links tools, copies harness config
pi                                     # installs packages from settings.json
/login anthropic                       # re-auth (secrets are never synced)
```

</details>

<details>
<summary><code>harness/omp/</code> (OMP)</summary>

`install.sh` links shared skills and agents into `~/.omp/agent` and each existing
OMP profile's `~/.omp/profiles/*/agent` directory, copies portable OMP config,
applies the versioned status-line settings, and installs the packages
below with OMP's native `omp install` command:

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| [`harness/omp/APPEND_SYSTEM.md`](harness/omp/APPEND_SYSTEM.md) | `~/.omp/agent/APPEND_SYSTEM.md` | Adds session lifecycle, bounded delegation, collision-safe scratch-artifact guidance, and browser-tool routing that defaults to headless `agent-browser` over the user's real browser. |
| [`harness/omp/plugins/pi-jev.txt`](harness/omp/plugins/pi-jev.txt) | Not copied; passed to `omp install` | Installs `npm:pi-jev@0.4.0`. OMP loads its legacy `pi.extensions` manifest through the Pi compatibility layer. |
| [`harness/omp/status-line/apply.sh`](harness/omp/status-line/apply.sh) | Default and existing profile `config.yml` files (via `omp config`) | Selectively merges the versioned Nerd Font status-line schema. |

The installer copies each top-level, non-dot file under `harness/omp/` as a whole
file. Nested files such as the plugin manifest and status-line applicator are not
copied. A differing destination file is replaced, so local edits to a managed
file such as `APPEND_SYSTEM.md` are clobbered the next time `install.sh` runs.
Native OMP package installation failure exits the installer with an error. OMP
normally delegates installs to `bun`; when `bun` is absent, `install.sh` runs
the official npm `bun` package through `npx` for that installation only.

OMP can run `pi-jev` because its extension loader accepts legacy
`pi.extensions` manifests and rewrites `@earendil-works/*` imports to OMP's
host packages. Configure `TYPESAFE_API_KEY` through the repository `.env` as
described above; `install.sh` writes the extension's shared secret-file fallback
and the user-session environment file. The
Jev tools and `/jev` commands are supported, while behavior that depends on
Pi-specific third-party extensions, such as `pi-subagents` orchestration,
still requires those dependencies to be installed and compatible.

After copying OMP artifacts for a detected OMP harness, `install.sh` runs the
status-line applicator against `~/.omp/agent/config.yml` and each existing
`~/.omp/profiles/*/agent/config.yml`. It compares every managed schema value with
`omp config get` and calls `omp config set` only for differences. Unrelated and
profile-local settings—including `composer.shape`, `modelRoles`,
`webSearchOrder`, and `setupVersion`—remain untouched; reruns are idempotent.
There is no copied `harness/omp/config.yml`.

The custom Nerd Font line uses each profile's chosen composer. It groups model,
compact context usage such as `39.0%/272K`, Git state, and session name on the
left, with elapsed time right-aligned. OMP keeps the status on one adaptive row
and drops trailing segments as width narrows.

To cap subagents at one delegation level, create or edit the machine-local file:

```yaml
task:
  maxRecursionDepth: 1
```

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
| [`worker`](agents/worker.md) | `openai-codex/gpt-6.1-sol` | Implementation agent for normal tasks and approved plans. Single writer thread; escalates unapproved decisions via `caller_ping`. |
| [`scout`](agents/scout.md) | `anthropic/claude-haiku-5-5` | Fast codebase recon that returns compressed context for handoff. Writes `context.md`. |
| [`researcher`](agents/researcher.md) | `anthropic/claude-sonnet-5-5` | Autonomous web researcher — searches, evaluates, and synthesizes a focused research brief into `research.md`. |
| [`planner`](agents/planner.md) | `anthropic/claude-fable-5-1` | Creates concrete implementation plans from context and requirements. Read-only; writes `plan.md`. |
| [`reviewer`](agents/reviewer.md) | `anthropic/claude-opus-5-5` | Versatile review specialist for code diffs, plans, proposed solutions, codebase health, and PR/issue validation. |

Model routing: Anthropic (1M context) handles long-horizon reading, research, planning, and
review; OpenAI handles implementation and independent judgment. Work is checked by a
different model family than produced it, so `reviewer` defaults to Anthropic to check
`worker` output, and the parent overrides it to `openai-codex/gpt-6.1-sol` to check
Anthropic-authored plans and context. The rule lives in
[`harness/pi/APPEND_SYSTEM.md`](harness/pi/APPEND_SYSTEM.md).
