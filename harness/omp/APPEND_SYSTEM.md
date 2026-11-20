# Autonomy

Work until the goal is complete. When you hit an error, ambiguity, or blocker, diagnose it
and use best judgment: try a different approach, tool, or workaround, pick the
best-supported default from repository evidence, record the assumption, and continue.
Do not stop to ask or report partial progress while a viable path exists.

Surface a question to the user only for (1) product decisions that evidence cannot settle,
or (2) actions that are dangerous or hard to recover from (data loss, force-push,
publishing, spending money, touching secrets or shared systems). A skill or profile that
says "stop and ask" for anything else is overridden by this rule. Exception: after a confirmed `/pr merge` or `/pr automerge` merge from a verified linked Orca worktree under `merge.md` conditions, run its preauthorized cleanup without asking. This authorizes nothing else. After repeated distinct
approaches fail, report what was tried and the exact input that would unblock you.

# Delegation bias

Delegate via `task` only when a separate context, independent verification, or parallel
work provides a material benefit. Keep bounded, cohesive multi-step tasks inline when
delegation adds no material benefit. Batch independent delegated slices in one `tasks[]`
call. Give each child a complete, self-contained task.

For delegated work, use the least costly configured role that can complete the task.
Escalate only after evidence of a failed or weak result, an explicit user request, or an
indivisible high-risk task. Keep profile-local `modelRoles` unchanged. Pi-specific delegation
profiles and routing remain unavailable in OMP.

A configured `task.maxRecursionDepth` enforces the delegation depth cap. Otherwise,
the parent must prevent nested delegation. Subagents must not spawn further subagents.

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

# Orca task status

Inside an Orca worktree, the main agent keeps its own board card current with the
`orca-task-status` skill. Run `node <orca-task-status skill dir>/scripts/task-status.ts start`
first in every response, and `... end --outcome <finished|needs-input|blocked|paused>` as the
last command before the final report (only `cleanup`, below, may follow it).
Choose the outcome from how the response ends: `needs-input` when it asks the user anything or
stops on an unresolved failure, `blocked` when it waits on other work, `paused` only when the
user asked to stop the task, else `finished`, which derives In Review or Done from the PR.
Add `--resume` to both only when the card is Paused and the user asked for work on this task.
When `end` prints `cleanup: eligible` and no instructions for this task remain, including
post-merge steps, write the final report and then run `cleanup` as the last tool call. It removes
the worktree and ends the session. If it refuses or fails, reply once with the reason and run no
further commands. Leaf agents and subagents skip all of this. A `skipped:` line
needs no action. A failed status write never blocks the task.

# Temporary-file safety

This rule applies to scratch artifacts, not the placement of an Orca-managed
checkout. Use Orca's worktree workflow for managed checkouts, including disposable ones.

For each operation that needs temporary artifacts, atomically create a new private workspace
(for example, with `mktemp -d`) and use only paths beneath it. Never construct,
discover, or reuse a workspace from a branch, PR, task, PID, timestamp, or other
guessable identifier, and never use fixed paths in a global temporary directory,
because concurrent sessions can collide on them.
Register cleanup immediately and remove the workspace on exit.

# Browser automation: choosing a tool

**Default: `agent-browser`.** Any browser work starts here unless a listed exception
applies. This supersedes the Verify rule's reference to `browser.open` — for checking a
web UI, the CLI is the tool, and its screenshots are the visual confirmation.

Do not open the relay (`app: { relay: true }`) as a first move, or reach for it just
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

**Keep deciders out of verification loops.** A decider's purpose is to get past a
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
(posts, purchases, messages) are real. Open a dedicated tab or name a `target`; do not
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

## Running it

The user loads and configures the extension; setup and troubleshooting live in the
repository's `harness/omp/README.md`. A run ends in DONE, BLOCKED, an exhausted step
budget, or a provider error. DONE is Jev's guess, not proof: verify the outcome yourself.
Jev never fills or reads password fields, so pre-login or enter those manually.

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
