# Delegation bias

Default to delegating substantive work to subagents via `task` rather than doing it
inline. Reserve the main thread for: decomposition, dispatch, integration, and final
verification. Spawn parallel subagents for independent slices in a single `tasks[]` batch.
Do trivial one-shot reads/edits yourself; anything multi-step or parallelizable -> delegate.
Subagents cannot spawn further (depth capped), so hand each a complete, self-contained slice.

# Session lifecycle

Use Orca for managed, visible worktree sessions; use `task`/`hub` for bounded
children; use Intercom for messages between independent sessions. After a timeout,
interruption, or ambiguous launch, inspect the relevant supervisor, Orca terminal
inventory, and Intercom roster before retrying. Reuse or stop the exact process
you own; silence does not prove that no launch occurred. Reconcile a session before
deleting its checkout.

For explicitly headless OMP, send EOF on stdin when no piped prompt is intended.
An open pipe can stall at `readPipedInput`. Do not use arbitrary log output as
readiness; use an application-specific handshake.

# Temporary-file safety

This rule applies to scratch artifacts, not the placement of an Orca-managed
checkout. Use Orca's worktree workflow for managed checkouts, including disposable ones.

For each operation that needs temporary artifacts, atomically create a new private workspace
(for example, with `mktemp -d`) and use only paths beneath it. NEVER construct,
discover, or reuse a workspace from a branch, PR, task, PID, timestamp, or other
guessable identifier, and NEVER use fixed paths in a global temporary directory.
Register cleanup immediately and remove the workspace on exit.

# Browser automation: choosing a tool

**Default: `agent-browser`.** Any browser work starts here unless a listed exception
applies. This supersedes the Verify rule's reference to `browser.open` — for checking a
web UI, the CLI is the tool, and its screenshots are the visual confirmation.

NEVER open the relay (`app: { relay: true }`) as a first move, and NEVER reach for it just
because a page is JavaScript-heavy, slow, or awkward — headless Chrome renders all of it.

Escalate away from the default only for a stated reason:

| Reason to escalate | Use |
| --- | --- |
| Site needs the user's real login, extensions, or 2FA, and `agent-browser` auth cannot hold it | OMP browser relay |
| Non-Chromium engine (Firefox/WebKit), Playwright API, or a committed `.spec.ts` | `playwright-cli` |
| The user explicitly asked for their own browser | OMP browser relay |

Say which reason applies before escalating. No reason → stay on `agent-browser`.

## Deciders vs actuators

Two different layers; do not confuse them.

- **Actuators** (`agent-browser`, `playwright-cli`) execute a named control. Deterministic:
  the same script does the same thing or fails.
- **Deciders** (Jev — jev-for-chrome, jev-ultrafast, `judge()` over a snapshot) choose
  *which* control advances a goal. Probabilistic; they route around obstacles by design.

**NEVER put a decider in a verification loop.** A decider's purpose is to get past a
broken control; a test's purpose is to fail on it. A Jev-driven run against a page whose
pay button had been removed picked the next-best button at confidence 1.0 and reported
success — the regression a deterministic `is visible` check caught immediately. Deciders
fail silently and confidently, which is the worst failure mode for a test.

Use a decider to **explore**, then freeze the result into a deterministic script and never
run the model again. Model at authoring time, not at runtime. `DONE` is an agent's
opinion, never proof: verify the outcome independently.

## agent-browser — the default

Reach for this first when the browser is a *test harness*, not a destination: checking a
dev server, capturing UI evidence, asserting page state, diffing against a baseline. It
runs headless Chrome behind a persistent daemon, so per-command cost is a socket
round-trip (`snapshot` ~4ms vs ~190ms for a fresh Node boot) and the gap compounds across
a multi-step flow. Fresh profile, no user credentials, nothing attributable to the user.
See the `agent-browser` skill.

## playwright-cli — when agent-browser cannot reach

Narrower but deeper. Required for a non-Chromium engine, for `run-code` against the real
Playwright API, or for `generate-locator` when the output must become a checked-in test.
Otherwise slower for the same work. See the `playwright-cli` skill.

## OMP browser relay — the user's real browser

`browser.open({ app: { relay: true } })` in eval drives the user's actual Chrome. Use it
only when authentication is the blocker — a site that needs their login, their extensions,
or a session you cannot legitimately recreate headlessly.

Treat it as acting **as the user**: sites attribute every action to them, and side effects
(posts, purchases, messages) are real. Open a dedicated tab or name a `target`; NEVER
navigate the visible tab without authorization. Prefer read-only observation, and confirm
before anything that writes.

Do not use the relay merely because it is convenient — a headless `agent-browser` run is
faster, reproducible, and carries no attribution risk.

## Authentication that does not need the relay

Before reaching for the user's browser, check whether `agent-browser` can hold the session
itself: `auth save|login` stores login profiles, `state save|load` persists cookies and
storage, and `--auto-connect` can borrow auth state from a running Chrome. A one-time
credential setup usually beats routing every future run through the relay.

# Browser automation with Jev-for-Chrome

jev-for-chrome is a Chrome extension that drives your real logged-in tabs with TypeSafe Jev. It's faster, simpler, and cheaper than traditional browser automation.

## When to use jev-for-chrome

A point-and-click alternative to the relay, for **human-driven tasks in the user's own
Chrome** — not for automated verification, where `agent-browser` is the default:
- Extracting data from pages
- Filling forms and signing up
- Navigating multi-step workflows
- Interacting with JavaScript-heavy sites
- Any task that needs your browser's actual sessions and extensions

## Setup

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

## How it works

When you click jev-for-chrome's icon, it reads the visible page:
- Every clickable/typeable element gets an indexed badge
- Jev gets the element table + your goal
- Jev picks one action per step: which element, which operation (click/type/select/scroll/done)
- The text model (if configured) writes actual text for form fields
- You see step-by-step decisions with confidences and timing

**Cost:** Near-zero compared to vision-based agents. ~$0.001–0.05 per task for most workflows.

**Speed:** Sub-second decisions; 15–30 steps in 10–30 seconds typical.

## Usage

### Run automatically
```
1. Go to target website
2. Click jev-for-chrome icon
3. Type your goal: "Find the cheapest item under $50 and add to cart"
4. Click "Run"
5. Watch it execute, click "Stop" to abort
```

### Step through manually
```
1. Same as above, but click "Step" instead of "Run"
2. Each click executes exactly one decision
3. See what Jev sees (numbered badges on page)
4. Check confidence and timing in the status bar
5. Copy trace when done (for debugging/sharing)
```

## When Jev stops

- **DONE**: Task appears complete (but verify manually—Jev's guess, not proof)
- **BLOCKED**: Jev thinks it's stuck (form field can't fill, loop detected)
- **Step budget exhausted**: Ran out of steps (adjust in Options)
- **Provider error**: API key invalid or rate limited

A DONE or BLOCKED with <50% confidence is asked again; Jev wants to be sure.

## Tips

- **Low confidence:** If Jev seems unsure, click "Step" to watch its reasoning
- **Elements not visible:** Scroll the page first, then click the icon
- **Password fields:** Never filled or read by Jev. Use manual entry or pre-login
- **New tabs:** If a click opens a new tab, Jev follows it and returns when you close the tab
- **Complex workflows:** Break into smaller tasks rather than one giant goal

## Troubleshooting

| Issue | Fix |
|---|---|
| Extension won't load | Check manifest.json in the dist/ folder; rebuild if needed: `npm run build` |
| "Test failed" in Options | Verify API key is correct; check endpoint URL matches your provider |
| Elements not clickable | Some elements (inside shadow DOM, iframes, canvas) aren't supported; see ROADMAP |
| Runs are too slow | Jev is making decisions; this is normal. Can't be faster than the model. |
| Form fields won't fill | Text model not configured, or field is a password (which is never filled) |

## Comparison

| | agent-browser | jev-for-chrome | jev-ultrafast (CLI) | relay + judge() |
|---|---|---|---|---|
| Setup time | 1 min (npm install) | 5 min (load extension) | 20 min (Python/uv/Browser Harness) | Built-in to OMP |
| Runs in | Own headless Chrome, fresh profile | Your real Chrome, your sessions | Separate headless browser | OMP's relay endpoint |
| Use case | **Default: testing, screenshots, verification** | Interactive human-driven tasks | Scripted/automated tasks | Auth-bound tasks needing decisions |
| UI/UX | CLI tool | Point-and-click popup | CLI tool | Programmatic (eval) |
| Acts as the user | No | Yes | No | Yes |
| Cost per task | No model cost | $0.001–0.05 | $0.001–0.05 | Included in OMP session |

---

## Advanced: OMP Browser Relay + Jev (fallback)

When you need programmatic control with Jev decisions (not just point-and-click):

```javascript
// In OMP eval
const tab = await browser.open({ app: { relay: true } });
const obs = await tab.observe();

const decision = await judge(JSON.stringify(obs), {
  next_action: {
    type: "choice",
    instructions: "Which button should we click?",
    criteria: {
      "submit": "Submit form button",
      "cancel": "Cancel and go back",
      "retry": "Retry the operation",
    },
  },
});

if (decision.next_action.choice === "submit") {
  await tab.click("button[type=submit]");
}
```

This gives full programmatic control but acts in the user's real session. Use it only when
authentication is the blocker; for testing and verification the default remains
`agent-browser`.
