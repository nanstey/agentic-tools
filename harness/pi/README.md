# Pi harness

`install.sh` copies the Pi configuration into `$PI_AGENT_DIR`, which defaults to
`~/.pi/agent` and follows `PI_CODING_AGENT_DIR` when set. These files are copied
rather than symlinked because Pi may rewrite them locally.

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| `harness/pi/settings.json` | `$PI_AGENT_DIR/settings.json` | Pi defaults (including codemode) and extension package list, including `npm:pi-intercom@0.12.0`, `npm:pi-subagents-lite@1.17.1` (adds `Agent`, `StopAgent`, `MessageAgent`, `AgentStatus` tools and `/agents`; no name clash with interactive-subagents), `npm:pi-fallback-models@0.1.1`, `npm:pi-jev@0.7.0`, and `npm:@lazco/pi-rich-model-selector@0.7.0` (replaces `/models` with a picker that shows context size, price, thinking levels, and key state; star models with `Ctrl+R` inside the picker, rebind with `/models bind star <key>`); `-jev_find_tools` removes the redundant tool router. |
| `harness/pi/pi-jev-auto.conf` | `~/.config/environment.d/91-pi-jev-auto.conf` | Enables Jev auto routing/skills, thinking, and tool guard; disables auto-model (`PI_JEV_AUTO_MODEL=0`), agent dispatch (`PI_JEV_AGENTS=0`), and compaction (`PI_JEV_COMPACT=0`, pi-jev 0.7.0 drops context) for Linux/systemd user sessions. `install.sh` copies this config when Pi is installed. The variables are user-wide, so OMP's pinned `pi-jev` also reads `PI_JEV_AUTO=1` and routes its prompts through Jev. |
| `harness/pi/APPEND_SYSTEM.md` | `$PI_AGENT_DIR/APPEND_SYSTEM.md` | Appends the `concise` communication style, conservative subagent tier/thinking bounds, cross-family verification, and main-agent model preservation rules to Pi's system prompt. |
| `harness/pi/patches/pi-diff-sdk-imports.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/@heyhuynhgiabuu/pi-diff/dist/index.js` | Uses static SDK/TUI imports so Pi's extension loader supplies the host modules. Hoisting alone cannot resolve native dynamic imports of uninstalled host peers. Not copied. |
| `harness/pi/patches/pi-subagent-widget-3.16.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/@maplezzk/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts` | Hides the denied-tools list in both child-widget views while preserving the separate tool-denial Set. Targets upstream 3.16.4. Not copied. |
| `harness/pi/patches/pi-subagent-done-requires-summary.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/@maplezzk/pi-interactive-subagents/pi-extension/subagents/subagent-done.ts` | Refuses an empty `subagent_done` until this turn has a non-empty assistant summary. Structured-result calls stay unchanged. Targets upstream 3.16.4. Not copied. |
| `harness/pi/patches/pi-jev.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/` (`src/jev.ts`, `extensions/index.ts`) | Unified diff that `install.sh` applies to `pi-jev`: rebuilds its SDK client on credential changes, adds `PI_JEV_API_KEY`, and disables auto-thinking in subagents. Not copied. |
| `harness/pi/patches/pi-fallback-reviewer-provider-lock.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-fallback-models/src/extension.ts` | Restricts reviewer fallback candidates to the baseline model's provider before model activation. Targets upstream 0.1.1. Not copied. |
| `harness/pi/patches/pi-jev-prompt-guard.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/` (`src/thinking.ts`, `extensions/index.ts`) | Unified diff that `install.sh` applies to `pi-jev`: tolerates a missing `event.prompt` (runs started by `sendCustomMessage`, such as subagent results) instead of throwing `Cannot read properties of undefined (reading 'trim')`. Not copied. |
| `harness/pi/patches/pi-jev-conservative-thinking.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/src/thinking.ts` | Routes only user-owned text, defaults to medium, and caps automatic thinking to one rank above the user-selected baseline. `xhigh` requires explicit user intent. Not copied. |
| `harness/pi/patches/pi-jev-self-improve-thinking.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/extensions/index.ts` | Disables auto-thinking for `PI_SELF_IMPROVE_CHILD` workers and reflections at router construction. The modular `patch-*` installer loop applies it with the other Jev patches. Not copied. |
| `harness/pi/tests/package-patches.test.sh` | Not installed | Offline regression tests for patch idempotency, missing packages, upstream mismatch safety, and twice-run sandboxed installation from pristine and partial Jev patch states. Run with `bash`. |
| `harness/pi/tests/fallback-provider-lock.test.mjs` | Not installed | Offline fallback tests for reviewer provider locks, exhaustion, settings scopes, switch-bus activation, and unchanged producer behavior. Run with `node`, passing the Pi SDK directory and a patched `pi-fallback-models` package directory. |
| `harness/pi/tests/fixtures/pi-jev-0.7.0/` | Not installed | Pristine upstream Jev sources for all 16 Jev patch-order subsets and thinking-policy regression tests. |
| `harness/pi/tests/fixtures/pi-jev-skill-wrapped-prompt.txt` | Not installed | Representative `before_agent_start` skill wrapper plus a plain user request for conservative thinking-policy regression tests. |
| `harness/pi/tests/fixtures/pi-interactive-subagents-3.16.4/` | Not installed | Pristine upstream `subagent-done.ts` and MIT license for sequential subagent patch tests. |
| `harness/pi/tests/package-extensions.test.mjs` | Not installed | Offline smoke tests for pi-diff registration and child-widget rendering/tool denial. Run with `node`, passing the installed Pi SDK package directory and Pi agent directory. |
| `harness/pi/tests/subagent-done-summary.test.mjs` | Not installed | Tests the patched empty-summary guard against a patched `subagent-done.ts`. `package-patches.test.sh` runs it in its installer sandbox. |
| `harness/pi/README.md` | Not installed | This document. `install.sh` skips `README.md` when it copies config. |
| `harness/pi/extensions/*.json` | `$PI_AGENT_DIR/extensions/` | Per-extension config. |
| `harness/pi/extensions/profile-secrets.ts` | `$PI_AGENT_DIR/extensions/profile-secrets.ts` | Exports the `NAME=value` secrets in `secrets/<profile>.env` into the environment while that `@nanstey/pi-auth-profiles` profile is active; unset names revert to the inherited value. |
| `harness/pi/bin/pi-secret` | `$PI_AGENT_DIR/bin/pi-secret` | CLI to set, unset, and list per-profile secrets (`pi-secret -p work set TYPESAFE_API_KEY`). Prompts without echo; files are mode 600. `install.sh` also symlinks it to `~/.local/bin/pi-secret` so ordinary shells find it. Run `set` from a normal terminal, not inside Pi. |
| `harness/pi/self-improve.json` | `$PI_AGENT_DIR/self-improve.json` | Policy defaults for the [self-improvement loop](#self-improvement-loop): reflection and worker caps, Terra/medium workers, and Sonnet/medium or Terra/medium independent reviewers. Reflection model and thinking inherit Pi defaults. Environment variables override it. |
| `harness/pi/extensions/self-improve.ts` | `$PI_AGENT_DIR/extensions/self-improve.ts` | Starts the [self-improvement loop](#self-improvement-loop): registers the `report_harness_issue` tool (agents call it on harness-caused procedural problems) and the `/self-improve` command (`status`, `now [note]`, `on`, `off`). Queued reports spawn a background reflection when the run settles. Not loaded in loop-started sessions (`PI_SELF_IMPROVE_CHILD`). |
| `harness/pi/bin/pi-improve` | `$PI_AGENT_DIR/bin/pi-improve` | Loop plumbing: `reflect` (detached headless `/reflect` session), `start` (worktree plus one `/improve` session, in an Orca terminal when Orca is reachable), `digest` (compact session-log view), `status`, `repo`. An interactive worker can start a human-requested follow-up only with `--user-requested "instruction"`. Also symlinked to `~/.local/bin/pi-improve`. Caps and the kill switch live here. |
| `harness/pi/prompts/reflect.md` | `$PI_AGENT_DIR/prompts/reflect.md` | `/reflect [report.json \| session.jsonl]`: runs the [`reflect`](../../skills/agent/reflect/SKILL.md) skill unattended on a session log, limited to harness-caused problems. Dedupes against open PRs and branches, then starts one `pi-improve start` run per real improvement (max 3) in place of the skill's approval step. Never edits files itself. |
| `harness/pi/prompts/improve.md` | `$PI_AGENT_DIR/prompts/improve.md` | `/improve <brief.md>`: end-to-end worker for one improvement in its own worktree: scope, implement, test, cross-family review, verify, and open the PR for human review. |
| `harness/pi/extensions/jev-router-openrouter-fallback.ts` | `$PI_AGENT_DIR/extensions/jev-router-openrouter-fallback.ts` | When no `TYPESAFE_API_KEY` is set but the active profile has OpenRouter auth, sets `PI_JEV_API_KEY` and `PI_JEV_BASE_URL` so pi-jev's tools bill to OpenRouter's System One endpoint. Pi's native classifier never sees the OpenRouter key. A real TypeSafe key or an external `PI_JEV_*` value always wins. |
| `harness/pi/extensions/collapse-tools.ts` | `$PI_AGENT_DIR/extensions/collapse-tools.ts` | Collapses tool output after all `session_start` handlers run, overriding `pi-diff`'s default of expanding it. |
| `harness/pi/extensions/pi-fallback.json` | `$PI_AGENT_DIR/extensions/pi-fallback.json` | Global model fallback chain for `pi-fallback-models`: `openai-codex/gpt-5.6-terra`, then `anthropic/claude-sonnet-5-5`, tried when the current model hits a quota, rate-limit, or provider error. |
| `harness/pi/extensions/pi-interactive-subagents/config.json` | `$PI_AGENT_DIR/extensions/pi-interactive-subagents/config.json` | Interactive-subagents config: mux settings plus `allowSubagentSpawning` and `subagentExtensions`. Package 3.16.4 starts each child with `--no-extensions` plus only the listed paths, so the list must include the Anthropic auth extensions (`pi-anthropic-auth`, `pi-auth-profiles`). Without them Anthropic subagents fail with `400 You're out of extra usage`, which looks like a quota error. The list also loads `pi-web-access`, `pi-fallback-models`, and `pi-intercom` (without it subagents never register with the intercom broker and cannot be reached). Agent profiles deny spawning via `deny-tools`. |
| `harness/pi/extensions/pi-extensions-i18n/config.json` | `$PI_AGENT_DIR/extensions/pi-extensions-i18n/config.json` | Locale for pi extension messages: `en-US`, because the library defaults to Chinese regardless of system locale. |
| `harness/pi/extensions/pi-intercom/config.json` | `$PI_AGENT_DIR/intercom/config.json` | Shared pi-intercom config: enabled inbound replies, no send confirmation, and reply hints. |
| `harness/pi/keybindings.json` | `$PI_AGENT_DIR/keybindings.json` | Custom keybindings. |
| `harness/pi/sleek.json` | `$PI_AGENT_DIR/sleek.json` | sleek-ui settings: side panel off (`sleek-sidePanel: false`). sleek-ui hardcodes `~/.pi/agent/sleek.json`, so the copy only takes effect when `PI_AGENT_DIR` is the default. `install.sh` overwrites this file, so changes made with `/sleek` must be copied back here to persist. |
| `harness/pi/vendor/*.txt` | cloned to `$PI_AGENT_DIR/vendor/<host>/<path>` | Manifests of `<url> <full commit SHA>` lines (one repo per line) for git repos that Pi's `git:` source cannot install (monorepos with one extension package per subdirectory and no root manifest). `install.sh` clones each at its commit and fails if any clone is missing, because Pi silently skips a local package path that does not exist. `settings.json` lists the subdirectories as relative local packages. |
| `harness/pi/vendor/pr83-glitch-pi-extensions.txt` | `$PI_AGENT_DIR/vendor/github.com/pr83-glitch/Pr83-glitch-Pi-Extensions` | [Pr83-glitch Pi Extensions](https://github.com/pr83-glitch/Pr83-glitch-Pi-Extensions) at commit `d5fb0f6`. Loaded subdirectories: `sleek-ui` (themes, status bars, split-diff edit blocks, side panel on `Ctrl+\`, `/sleek` settings stored in `~/.pi/agent/sleek.json`) and `edit-message` (`Alt+E` or `/edit-message` to edit-and-regenerate, copy, or summarize-and-fork a previous user message; `Alt+R` or `/edit-message-name` to name the session). `modgate` is not loaded. |
| Durable Pi-directory contract | Durable-derived per-agent Pi directories symlink `auth-profiles/`, `secrets/`, `profile-meta/`, `extensions/`, `skills/`, `agents/`, and `prompts/` from `$PI_AGENT_DIR`. | `durable profile` creates and owns `profile-meta/<name>.json`. Rename one of these directories only after durable has merged and verified the compatible migration (the durable-first sequence). |

The main agent stays on the user's selected model unless a provider/failure fallback is
needed. Context- and scale-based model selection applies only to subagent tasks.
Subagent tier and thinking come from a `codemode` `models.classify()` recommendation,
then the parent applies evidence bounds (see `APPEND_SYSTEM.md`). Ordinary work starts
at standard/medium. Low confidence does not cause escalation. High requires demonstrated
cross-boundary complexity or high blast radius. Premium and `xhigh` require an explicit
request or an indivisible irreversible or security-critical task, plus a recorded reason.
Reviewers use the opposite producer family at the same tier with an explicit thinking suffix.
Provider fallback can change the actual family, so successful-message log checks remain required.

After installation, start Pi from a new login session so `environment.d` applies,
or export `PI_JEV_AUTO_MODEL=0` in the
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

## Self-improvement loop

When an agent hits a procedural problem caused by the harness itself (a wrong or stale
skill, agent profile, system-prompt rule, tool config, or installer gap), it calls
`report_harness_issue`. The loop then runs unattended:

1. When the run settles, `pi-improve reflect` starts a detached headless Pi session that runs
   `/reflect` against the previous session's log (log under `$PI_AGENT_DIR/self-improve/logs/`).
2. `/reflect` finds the root cause, checks it is real and not already fixed or in review, and
   for each distinct improvement (max 3) runs `pi-improve start <slug>` with a self-contained,
   redacted brief.
3. `pi-improve start` creates a dedicated worktree of this repo (Orca-managed when Orca is
   reachable, else `git worktree`) and launches one Pi session there running `/improve`.
   That session scopes, implements, tests, gets a review from a different model family,
   verifies, and opens a PR. A human reviews and merges; nothing merges itself.

Guards: loop-started sessions cannot report back (no recursion). A worker normally cannot
start work. After its final output, a human can explicitly request one direct follow-up from an
interactive worker with `pi-improve start <unique-slug> --user-requested "instruction"`.
Headless workers and user-requested follow-ups cannot use this exception. The instruction must
be one line, use at most 280 characters, contain no secrets, and is recorded in the run state
and generated brief. Do not use `--force`. This exception does not bypass one reflection per
source session, 5 per 24 hours (`PI_IMPROVE_MAX_REFLECTIONS_PER_DAY`), the root reflection cap
of 3 workers (`PI_IMPROVE_MAX_WORKERS`), dedupe, or the kill switch. Kill switch:
`/self-improve off`, `PI_SELF_IMPROVE=0`, or the file
`$PI_AGENT_DIR/self-improve/disabled`. `pi-improve status` lists runs;
`PI_IMPROVE_DRY_RUN=1` prints what `reflect`/`start` would do. Defaults come from `self-improve.json`: workers run
`openai-codex/gpt-5.6-terra` at medium thinking. OpenAI workers use a
`anthropic/claude-sonnet-5-5:medium` reviewer. Anthropic workers use
`openai-codex/gpt-5.6-terra:medium`. Reflection model and thinking defaults stay empty,
so they inherit Pi's Sonnet/medium defaults. Jev auto-thinking does not override workers
or reflections marked with `PI_SELF_IMPROVE_CHILD`. Explicit environment and CLI overrides
remain available (`PI_IMPROVE_WORKER_MODEL`, `PI_IMPROVE_REVIEWER_MODEL`, `PI_IMPROVE_REFLECT_MODEL`).
`install.sh` records the main checkout in `$PI_AGENT_DIR/self-improve/repo`;
`AGENTIC_TOOLS_REPO` overrides it. Run `/reflect` by hand on any session log or report.
The repo is public, so briefs and PRs must stay redacted; the prompts require it.

Offline tests (no models, worktrees, or PRs): `harness/pi/tests/pi-improve.test.sh` covers option parsing, caps and dedupe under concurrency, the reviewer-family rule, the kill switch, and a sandboxed idempotent install. `harness/pi/tests/fixtures/seeded-defect.jsonl` is a session log with one seeded harness defect for checking `/reflect` by hand. These files are not installed.

## Per-profile secrets (`pi-secret`)

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

`install.sh` patches the following installed third-party packages. Re-run it after Pi installs or
updates packages, because updates overwrite the patches. Each patch is idempotent. If upstream code
changed, it reports an error and leaves the file untouched, and `install.sh` finishes the other
installs and then exits 1.

- **`@heyhuynhgiabuu/pi-diff`:** 0.9.3 catches native dynamic-import errors before Pi's
  loader can supply its SDK aliases. The patch uses static imports of the host SDK and TUI;
  it does not install a separate SDK. Drop it once upstream uses host-compatible imports.
- **`@maplezzk/pi-interactive-subagents`:** the child widget prints a "N denied" count for
  tools that are never registered. The widget patch keeps the display list empty so both views
  show only available tools, without changing tool-denial enforcement. The separate summary patch
  refuses a result-less `subagent_done` when no assistant text follows the latest user message.
  Result and structured-output calls stay unchanged. Drop each patch once upstream provides its fix.
- **`pi-fallback-models`:** 0.1.1 classifies Anthropic's "You're out of extra usage" 400 as
  ignorable, so no fallback happens on that quota error. The quota patch adds that phrase.
  A separate provider-lock patch restricts `PI_SUBAGENT_AGENT=reviewer` candidates to the
  baseline model's provider before either activation path runs. If no usable candidate remains,
  the extension reports exhausted fallbacks without switching or retrying on another provider.
  A missing baseline also blocks reviewer fallbacks. Other roles and the main agent keep
  cross-provider fallbacks. The lock covers session, directory, and global chains. It compares
  providers, not families, so a routed provider such as OpenRouter is not covered.
  Drop each patch once upstream provides the corresponding behavior.
- **`pi-jev`:** 0.7.0 builds its SDK client once, so a profile switch keeps the first profile's
  key and endpoint. `harness/pi/patches/pi-jev.patch` (a unified diff applied with `patch`)
  rebuilds the client when the resolved key or base URL changes, reads `PI_JEV_API_KEY` ahead of
  `TYPESAFE_API_KEY`, and skips auto-thinking in named subagents so the parent-selected
  model suffix stays in force. The separate `pi-jev-self-improve-thinking.patch` disables
  the thinking router for self-improvement workers and reflections, preserving their
  selected or inherited level. Ordinary main sessions keep automatic thinking enabled.
  `pi-jev-prompt-guard.patch` tolerates missing prompts from custom-message runs.
  `pi-jev-conservative-thinking.patch` strips injected skills, tagged context, pasted
  content, and handoffs before classification; ordinary or empty user text stays medium,
  high is the automatic ceiling unless the user explicitly requests `xhigh`, `think hard`,
  or `ultrathink`, and every automatic result remains within one rank above the selected
  baseline. Drop each patch once upstream provides its fix.

Secrets and machine-local state (`auth.json`, `auth-profiles/`, `web-search.json`,
`trust.json`, sessions, run history) are git-ignored and never travel — re-auth
per machine with `/login`.

To pull live config changes back into the repo, use the [`pi-sync`](../../.agents/skills/pi-sync/SKILL.md)
skill (allowlist-based; it never reads or copies secrets).

## Pi agent profiles

The profiles under [`agents/`](../../agents/) are written for `@maplezzk/pi-interactive-subagents`
(frontmatter `system-prompt`, `interactive`, `deny-tools`). They omit `model` and `thinking`.
The dispatcher selects both for each task under the routing policy and passes an explicit
`model:thinking` suffix. Every profile ends by calling `subagent_done`: spawning tools are
denied, and blockers go to the parent through `caller_ping`. Profiles do not auto-create
handoff files; the delegating agent names output paths in the task.

## New machine bootstrap
```sh
git clone git@github.com:nanstey/agentic-tools.git ~/Code/skills
cd ~/Code/skills && bash install.sh   # links tools, copies harness config
pi                                     # installs packages from settings.json
/login anthropic                       # re-auth (secrets are never synced)
```
