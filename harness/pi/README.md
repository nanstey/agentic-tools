# Pi harness

`install.sh` copies the Pi configuration into `$PI_AGENT_DIR`, which defaults to
`~/.pi/agent` and follows `PI_CODING_AGENT_DIR` when set. These files are copied
rather than symlinked because Pi may rewrite them locally.

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| `harness/pi/settings.json` | `$PI_AGENT_DIR/settings.json` | Pi defaults (including codemode) and extension packages, including `npm:pi-subagents-lite@1.17.1` (the sole delegation mechanism; provides `Agent`, `StopAgent`, `MessageAgent`, `AgentStatus`, and `/agents`), `npm:pi-intercom@0.12.0`, `npm:pi-fallback-models@0.1.1`, `npm:pi-jev@0.7.0`, and `npm:@lazco/pi-rich-model-selector@0.7.0`; `-jev_find_tools` removes the redundant tool router. |
| `harness/pi/pi-jev-auto.conf` | `~/.config/environment.d/91-pi-jev-auto.conf` | Enables Jev auto routing/skills, thinking, and tool guard; disables auto-model (`PI_JEV_AUTO_MODEL=0`), agent dispatch (`PI_JEV_AGENTS=0`), and compaction (`PI_JEV_COMPACT=0`, pi-jev 0.7.0 drops context) for Linux/systemd user sessions. `install.sh` copies this config when Pi is installed. The variables are user-wide, so OMP's pinned `pi-jev` also reads `PI_JEV_AUTO=1` and routes its prompts through Jev. |
| `harness/pi/APPEND_SYSTEM.md` | `$PI_AGENT_DIR/APPEND_SYSTEM.md` | Appends concise communication, Lite agent-type tier/model rules, fallback limitations, cross-family verification evidence, and main-agent model preservation rules. |
| `harness/pi/patches/pi-diff-sdk-imports.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/@heyhuynhgiabuu/pi-diff/dist/index.js` | Uses static SDK/TUI imports so Pi's extension loader supplies the host modules. Hoisting alone cannot resolve native dynamic imports of uninstalled host peers. Not copied. |
| `harness/pi/patches/pi-jev.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/src/jev.ts` | Unified diff that `install.sh` applies to `pi-jev`: rebuilds its SDK client on credential changes and adds `PI_JEV_API_KEY`. Not copied. |
| `harness/pi/patches/pi-jev-prompt-guard.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/` (`src/thinking.ts`, `extensions/index.ts`) | Unified diff that `install.sh` applies to `pi-jev`: tolerates a missing `event.prompt` (runs started by `sendCustomMessage`, such as agent completion messages) instead of throwing `Cannot read properties of undefined (reading 'trim')`. Not copied. |
| `harness/pi/patches/pi-jev-conservative-thinking.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/src/thinking.ts` | Routes only user-owned text, defaults to medium, and caps automatic thinking to one rank above the user-selected baseline. `xhigh` requires explicit user intent. Not copied. |
| `harness/pi/patches/pi-jev-self-improve-thinking.patch` | applied to `$PI_AGENT_DIR/npm/node_modules/pi-jev/extensions/index.ts` | Disables auto-thinking for `PI_SELF_IMPROVE_CHILD` workers and reflections at router construction. Lite fixed-tier agents instead exclude the `pi-jev` extension in their frontmatter. The modular `patch-*` installer loop applies it with the other Jev patches. Not copied. |
| `harness/pi/tests/package-patches.test.sh` | Not installed | Offline regression tests for patch idempotency, missing packages, upstream mismatch safety, retired-package removal, and twice-run sandboxed installation from pristine and partial Jev patch states. Run with `bash`. |
| `install/tests/agent-drift.test.sh` | Not installed | Offline check that agent tier bodies, fixed model/thinking frontmatter, and README catalog rows stay synchronized. Run with `bash`. |
| `harness/pi/tests/fixtures/pi-jev-0.7.0/` | Not installed | Pristine upstream Jev sources for all 16 Jev patch-order subsets and thinking-policy regression tests. |
| `harness/pi/tests/fixtures/pi-jev-skill-wrapped-prompt.txt` | Not installed | Representative `before_agent_start` skill wrapper plus a plain user request for conservative thinking-policy regression tests. |
| `harness/pi/tests/package-extensions.test.mjs` | Not installed | Offline smoke test for pi-diff registration. Run with `node`, passing the installed Pi SDK package directory and Pi agent directory. |
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
| Retired delegation cleanup | `$PI_AGENT_DIR/npm/package.json`, `$PI_AGENT_DIR/npm/node_modules/@maplezzk/...`, and `$PI_AGENT_DIR/extensions/...` | `install.sh` removes the retired direct dependency with pnpm, then removes its package and configuration. This is idempotent and prevents a later `pi install` from rehydrating stale state. |
| `harness/pi/extensions/pi-extensions-i18n/config.json` | `$PI_AGENT_DIR/extensions/pi-extensions-i18n/config.json` | Locale for pi extension messages: `en-US`, because the library defaults to Chinese regardless of system locale. |
| `harness/pi/extensions/pi-intercom/config.json` | `$PI_AGENT_DIR/intercom/config.json` | Shared pi-intercom config: enabled inbound replies, no send confirmation, and reply hints. |
| `harness/pi/keybindings.json` | `$PI_AGENT_DIR/keybindings.json` | Custom keybindings. |
| `harness/pi/sleek.json` | `$PI_AGENT_DIR/sleek.json` | sleek-ui settings: side panel off (`sleek-sidePanel: false`). sleek-ui hardcodes `~/.pi/agent/sleek.json`, so the copy only takes effect when `PI_AGENT_DIR` is the default. `install.sh` overwrites this file, so changes made with `/sleek` must be copied back here to persist. |
| `harness/pi/vendor/*.txt` | cloned to `$PI_AGENT_DIR/vendor/<host>/<path>` | Manifests of `<url> <full commit SHA>` lines (one repo per line) for git repos that Pi's `git:` source cannot install (monorepos with one extension package per subdirectory and no root manifest). `install.sh` clones each at its commit and fails if any clone is missing, because Pi silently skips a local package path that does not exist. `settings.json` lists the subdirectories as relative local packages. |
| `harness/pi/vendor/pr83-glitch-pi-extensions.txt` | `$PI_AGENT_DIR/vendor/github.com/pr83-glitch/Pr83-glitch-Pi-Extensions` | [Pr83-glitch Pi Extensions](https://github.com/pr83-glitch/Pr83-glitch-Pi-Extensions) at commit `d5fb0f6`. Loaded subdirectories: `sleek-ui` (themes, status bars, split-diff edit blocks, side panel on `Ctrl+\`, `/sleek` settings stored in `~/.pi/agent/sleek.json`) and `edit-message` (`Alt+E` or `/edit-message` to edit-and-regenerate, copy, or summarize-and-fork a previous user message; `Alt+R` or `/edit-message-name` to name the session). `modgate` is not loaded. |
| Durable Pi-directory contract | Durable-derived per-agent Pi directories symlink `auth-profiles/`, `secrets/`, `profile-meta/`, `extensions/`, `skills/`, `agents/`, and `prompts/` from `$PI_AGENT_DIR`. | `durable profile` creates and owns `profile-meta/<name>.json`. Rename one of these directories only after durable has merged and verified the compatible migration (the durable-first sequence). |

The main agent stays on the user's selected model unless a provider/failure fallback is
needed. Context- and scale-based selection applies only to Lite agent types. A `codemode`
`models.classify()` recommendation selects the role's `quick`, `standard`, `high`, or
`premium` suffix; frontmatter pins its model and thinking. Ordinary work starts at
standard/medium. Low confidence does not cause escalation. High requires demonstrated
cross-boundary complexity or high blast radius. Premium requires an explicit request or an
indivisible irreversible or security-critical task, plus a recorded reason. Reviewer types
use the opposite producer family at the same tier. See `APPEND_SYSTEM.md` for the fallback
and model-provenance limitations.

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
skill, agent type, system-prompt rule, tool config, or installer gap), it calls
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
- **`pi-fallback-models`:** 0.1.1 classifies Anthropic's "You're out of extra usage" 400 as
  ignorable, so no fallback happens on that quota error. The quota patch adds that phrase.
  Lite children load it through `extensions: true`, but its global fallback chain cannot enforce
  reviewer-family independence or the per-cell fallback arrows. The parent must record the final
  model and treat unknown or potentially mixed provenance as a review gap. Drop the quota patch
  once upstream provides the corresponding behavior.
- **`pi-jev`:** 0.7.0 builds its SDK client once, so a profile switch keeps the first profile's
  key and endpoint. `harness/pi/patches/pi-jev.patch` (a unified diff applied with `patch`)
  rebuilds the client when the resolved key or base URL changes and reads `PI_JEV_API_KEY` ahead of
  `TYPESAFE_API_KEY`. The separate `pi-jev-self-improve-thinking.patch` disables
  the thinking router for self-improvement workers and reflections, preserving their
  selected or inherited level. Lite fixed-tier agents exclude the `pi-jev` extension instead;
  ordinary main sessions keep automatic thinking enabled.
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

## Pi agent types

The 24 files under [`agents/`](../../agents/) are Pi-only Lite agent types named
`<role>-<tier>`; reviewers add a producer-family suffix. `install.sh` links them only into
`$PI_AGENT_DIR/agents`, not Claude or OMP. Their frontmatter uses Lite fields (`tools`,
`extensions`, `exclude_extensions`, `skills`, `model`, `thinking`, `output_transcript`, and
prompt/context settings). Every type pins the table's primary model and fixed tier thinking and
excludes `pi-jev`, so auto-thinking cannot override that level. Reviewer types are report-only
and omit `edit`/`write`; `bash` remains an unenforced mutation gap. `extensions: true` loads
normal child extensions, including auth and model fallback. Each run writes a human-readable
result transcript to `/tmp/pi-agent-outputs/<agentId>.log`; only its background parent-session
completion record carries the final resolved model. Profiles do not auto-create handoff files;
the delegating agent names output paths in the task.

## New machine bootstrap
```sh
git clone git@github.com:nanstey/agentic-tools.git ~/Code/skills
cd ~/Code/skills && bash install.sh   # links tools, copies harness config
pi                                     # installs packages from settings.json
/login anthropic                       # re-auth (secrets are never synced)
```
