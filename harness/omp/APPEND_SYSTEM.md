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

# Browser relay with Jev judging

OMP's browser relay (`app.relay: true`) lets you drive your real logged-in Chrome. Jev provides typed judgments for deciding which action to take next—outperforming prompt-and-parse loops and avoiding token-heavy reasoning chains.

## Relay basics

Browser relay mode lets you specify a `target` to select a tab by URL/title substring or adopt the visible tab without renaming it. Once adopted, navigate and interact just as with managed browser mode:

```
browser.open({ app: { relay: true, target: "tab title substring" }, ... })
tab.click(selector)
await tab.observe()
const screenshot = await tab.screenshot()
```

Your session and cookies are already present—no re-auth needed. The relay endpoint is yours; do not share it. Closing the relay tab in code does NOT close your browser tab, only the relay connection.

## Jev judging patterns

When relay drives pages with rich interactivity, structure decisions as Jev judgments instead of prompt reasoning:

- **Pick one action from many:** Jev chooses the single best click, input, or state transition from observed page elements; exact scores and reasoning are built in.
- **Bound the search space:** Give Jev only relevant questions—e.g., "which button should we click next?" rather than "what do you think the page is for?"—so it makes fast, focused calls.
- **Avoid token-heavy loops:** Prompt-and-parse reasoning at each step is slow and expensive; Jev judgments scale to long sequences (16+ steps) at near-constant cost per decision.

Example: scoring page elements for a form-fill task.

```javascript
// Observe the page
const obs = await tab.observe();

// Ask Jev to pick the next input field or submit button
const judgment = await judge(JSON.stringify(obs), {
  next_action: {
    type: "choice",
    instructions: "Choose the next form element to interact with or stop",
    criteria: {
      "email_field": "Text input for email address",
      "password_field": "Text input for password",
      "submit_button": "Form submit button",
      "stop": "Form is complete or blocked",
    },
  },
});

if (judgment.next_action.choice === "email_field") {
  await tab.fill(obs.elements.find(e => e.name === "email").id, "user@example.com");
} else if (judgment.next_action.choice === "password_field") {
  await tab.fill(obs.elements.find(e => e.name === "password").id, "...");
}
// etc.
```

## Cost and constraints

- Jev operates on structured page state (accessibility tree, JSON), not screenshots—much cheaper than vision.
- Each judgment is a TypeSafe API call; hundreds per complex task cost only a few cents.
- Relay depends on your browser session; timeouts and interruptions close the connection but not your browser.
- Password fields: never pass them to Jev. Use `tab.fill` directly or seed cookies instead.

## Confidence and stuck detection

Jev returns per-judgment confidence and stuck probability. Use these to stop early:

```javascript
const judgment = await judge(state, questions);

if (judgment.next_action.confidence < 0.4) {
  console.log("Low confidence; stopping to avoid wrong action");
  return;
}

if (judgment.stuck > 0.7) {
  console.log("Run appears stuck; retrying with a different approach");
  // restart, change task, or escalate
}
```

## When to relay instead of managed browser

Use relay when:
- You are already signed into Chrome and need to preserve that session state.
- The page requires interactive elements specific to your account (admin dashboards, account settings).
- You want to avoid creating new browser profiles or re-authenticating.

Use managed browser when:
- Starting fresh (no account context needed).
- Running in isolation or on a remote machine.
- Automating on behalf of a service account (not your personal browser).
