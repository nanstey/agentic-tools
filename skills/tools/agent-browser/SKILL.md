---
name: agent-browser
description: Runs Jev-driven browser tasks in a background Chromium using persistent, separately-authenticated profiles, so agents get your logins without touching your interactive Chrome. Use for authenticated background browser automation via the `agent-browser` CLI.
user-invocable: true
disable-model-invocation: false
---

# Agent Browser

Separates **browser identity** from **browser UI**: agents run against a persistent, authenticated Chromium profile in the background, never your interactive Chrome. Built on Playwright's persistent contexts and [`@jkudish/jev-browser`](https://github.com/jkudish/jev-browser)'s injected-`Page` mode.

```text
you (once)  → agent-browser login <profile>   headed Chromium, manual auth + 2FA
agents      → agent-browser run <profile> …   headless Chromium, same cookies, Jev decides
```

## Prerequisites

- Node.js 22+ and npm.
- `TYPESAFE_API_KEY` in the environment, or the shared secret at `~/.pi/agent/secrets/typesafe_api_key` (read automatically).
- Optional typing model for form fills: configure `JEV_BROWSER_TYPE_*` per jev-browser's docs (without one, typed fields other than search boxes stay empty).

## Install

```sh
bash setup.sh   # from this skill directory
```

Idempotent. Installs `playwright` + `@jkudish/jev-browser` into `~/.browser-agent/` (override with `AGENT_BROWSER_HOME`), downloads Playwright Chromium, and links `~/.local/bin/agent-browser`.

## Workflow

1. **Authenticate a profile once** — either headed login or cookie import:

   **Headed login** (robust; do 2FA yourself; close the window to save):
   ```sh
   agent-browser login github https://github.com/login
   ```

   **Import from your real Chrome** (bootstrap shortcut). Opt in once on that Chrome via `chrome://inspect/#remote-debugging` → "Allow remote debugging for this browser instance" (Chrome 136+ blocks the `--remote-debugging-port` flag on default profiles), then:
   ```sh
   agent-browser import github --domains github.com
   ```
   Pulls decrypted cookies over CDP (`--port 9222` default) into the agent profile without touching your Chrome. Limits: localStorage/SPA bearer tokens do not transfer, and device/IP-bound cookies (e.g. `cf_clearance`) will not validate. If the site rejects the imported session, fall back to `login`.

   Keep profiles per identity: `personal`, `github`, `google-work`. Cookies, localStorage, IndexedDB, and service workers persist in `~/.browser-agent/profiles/<name>` (mode 0700).

2. **Run tasks headlessly** against that identity:
   ```sh
   agent-browser run github "Open my newest notification and stop on it" https://github.com/notifications
   ```
   Prints the jev-browser result JSON (status, final URL, step trace with confidences, page content, usage/cost). Exit 0 on `done`/`goal_achieved`, 2 on other stop statuses, 1 on error.

3. **List profiles**: `agent-browser list`.

Options for `run`: `--headed`, `--max-steps N` (default 24), `--format text|markdown|html|aria`.

## Sites that block headless

Some sites (e.g. X) reject headless Chromium. Run headed on a virtual display so nothing steals your desktop focus:

```sh
xvfb-run -a agent-browser run github "…" https://…
```

## Boundaries

- A run treats the profile's browser context as exclusively Jev's; do not run two tasks against one profile concurrently.
- Passwords are never typed by the model. Re-auth by rerunning `login`; seed cookies are unnecessary and unsupported here (the profile carries auth).
- Sessions expire like any browser's. A run that lands on a login page means: rerun `login <profile>`.
- `done` is the agent's opinion, not proof — check `final_url` and page content in the result.
