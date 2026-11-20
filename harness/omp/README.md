# OMP harness

`install.sh` links shared skills into `~/.omp/agent` and each existing OMP profile's
`~/.omp/profiles/*/agent` directory, copies portable OMP config,
applies the versioned status-line settings, and installs the packages
below with OMP's native `omp install` command. The agent profiles under `agents/` are Pi-only and are not linked into OMP.

| Repository path | Install destination | Purpose |
| --- | --- | --- |
| [`harness/omp/APPEND_SYSTEM.md`](APPEND_SYSTEM.md) | `~/.omp/agent/APPEND_SYSTEM.md` | Adds session lifecycle, Orca task-status updates at the start and end of each response with post-merge worktree cleanup, benefit-based subagent use with least-cost configured roles, collision-safe scratch-artifact guidance, and browser-tool routing that defaults to headless `agent-browser` over the user's real browser. |
| [`harness/omp/plugins/pi-jev.txt`](plugins/pi-jev.txt) | Not copied; passed to `omp install` | Installs `npm:pi-jev@0.4.0`. OMP loads its legacy `pi.extensions` manifest through the Pi compatibility layer. |
| [`harness/omp/README.md`](README.md) | Not copied | This document. `install.sh` skips `README.md` when it copies config. |
| [`harness/omp/status-line/apply.sh`](status-line/apply.sh) | Default and existing profile `config.yml` files (via `omp config`) | Selectively merges the versioned Nerd Font status-line schema. |

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
described in the [Pi harness](../pi/README.md#per-profile-secrets-pi-secret) docs; `install.sh` writes the extension's shared secret-file fallback
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

To cap subagents at one subagent level, create or edit the machine-local file:

```yaml
task:
  maxRecursionDepth: 1
```

## jev-for-chrome setup

Human setup and usage for the jev-for-chrome extension. `APPEND_SYSTEM.md` keeps only
the routing and verification rules the agent needs.

### Setup

1. **Load the extension:**
   - Go to `chrome://extensions`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select `/tmp/jev-for-chrome/dist` (or wherever you built it)

2. **Configure API key:**
   - Click the jev-for-chrome icon
   - Click "Options" (gear icon)
   - Choose "TypeSafe.ai" provider
   - Endpoint: `https://api.typesafe.ai/v1/systemone`
   - API Key: from `~/.pi/agent/secrets/typesafe_api_key`
   - Click "Test" to verify

3. **Optional: Add text helper**
   - For form fills, configure a text model
   - OpenRouter works (same key as above if you have one)
   - DeepSeek direct: `https://api.deepseek.com`

### How it works

When you click jev-for-chrome's icon, it reads the visible page:
- Every clickable/typeable element gets an indexed badge
- Jev gets the element table + your goal
- Jev picks one action per step: which element, which operation (click/type/select/scroll/done)
- The text model (if configured) writes actual text for form fields
- You see step-by-step decisions with confidences and timing

**Cost:** Near-zero compared to vision-based agents. ~$0.001–0.05 per task for most workflows.

**Speed:** Sub-second decisions; 15–30 steps in 10–30 seconds typical.

### Usage

#### Run automatically
```
1. Go to target website
2. Click jev-for-chrome icon
3. Type your goal: "Find the cheapest item under $50 and add to cart"
4. Click "Run"
5. Watch it execute, click "Stop" to abort
```

#### Step through manually
```
1. Same as above, but click "Step" instead of "Run"
2. Each click executes exactly one decision
3. See what Jev sees (numbered badges on page)
4. Check confidence and timing in the status bar
5. Copy trace when done (for debugging/sharing)
```

### When Jev stops

- **DONE**: Task appears complete (but verify manually—Jev's guess, not proof)
- **BLOCKED**: Jev thinks it's stuck (form field can't fill, loop detected)
- **Step budget exhausted**: Ran out of steps (adjust in Options)
- **Provider error**: API key invalid or rate limited

A DONE or BLOCKED with <50% confidence is asked again; Jev wants to be sure.

### Tips

- **Low confidence:** If Jev seems unsure, click "Step" to watch its reasoning
- **Elements not visible:** Scroll the page first, then click the icon
- **Password fields:** Never filled or read by Jev. Use manual entry or pre-login
- **New tabs:** If a click opens a new tab, Jev follows it and returns when you close the tab
- **Complex workflows:** Break into smaller tasks rather than one giant goal

### Troubleshooting

| Issue | Fix |
|---|---|
| Extension won't load | Check manifest.json in the dist/ folder; rebuild if needed: `npm run build` |
| "Test failed" in Options | Verify API key is correct; check endpoint URL matches your provider |
| Elements not clickable | Some elements (inside shadow DOM, iframes, canvas) aren't supported; see ROADMAP |
| Runs are too slow | Jev is making decisions; this is normal. Can't be faster than the model. |
| Form fields won't fill | Text model not configured, or field is a password (which is never filled) |
