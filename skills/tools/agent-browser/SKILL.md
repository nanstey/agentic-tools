---
name: agent-browser
description: Fast headless browser testing and screenshots from the CLI — navigate, interact via accessibility-tree refs, assert page state, and diff snapshots or screenshots against a baseline. Use when a task needs quick headless browser checks, UI screenshots, or visual regression comparison via the `agent-browser` tool.
user-invocable: true
disable-model-invocation: false
---

# Fast Headless Browser Testing with agent-browser

Native Rust CLI plus a persistent daemon, driving Chrome over CDP. Upstream:
[`vercel-labs/agent-browser`](https://github.com/vercel-labs/agent-browser) (Apache-2.0).

It is **not** a browser engine and does not make Chrome render faster. The win is
per-command overhead: a ~7 MB Rust daemon holds the browser open, so each command is a
socket round-trip instead of a fresh Node/V8 boot. Measured against `playwright-cli` on
the same page and same machine:

| command | agent-browser | playwright-cli |
| --- | --- | --- |
| cold `open` | 301 ms | 519 ms |
| `snapshot` | 4.3 ms | 191.4 ms |
| `screenshot` | 33.1 ms | 202.7 ms |

The gap is per-invocation cost, so it compounds with step count: a 30-step flow saves
seconds, a 2-step flow saves little.

## Start here

This file is a decision guide, not the command reference. The CLI serves its own guide,
version-matched to the installed binary, so it never goes stale:

```bash
agent-browser skills get core          # workflows, ref usage, patterns
agent-browser skills get core --full   # + full command reference and templates
agent-browser skills list              # electron, slack, dogfood, ...
```

Load `skills get core` before composing anything beyond the recipes below. Do not guess
flags from memory — this CLI moves fast.

## Install

From the tools repository root:

```bash
./install.sh --tool agent-browser
```

Needs Node 20+. Installs the npm package (prebuilt native binary, no Rust toolchain) and
provisions a browser. Verify with `agent-browser --version`.

If a command behaves unlike the docs, check for a shadowing binary first:
`command -v agent-browser` must resolve inside your npm prefix.

## Choosing between the browser tools

| Use | When |
| --- | --- |
| `agent-browser` | **Default.** Headless test loops, many steps, fast screenshots, visual regression, any verification of code you are working on. |
| `playwright-cli` | Cross-browser (Firefox/WebKit), Playwright API access, `generate-locator` for a committed spec. |
| OMP browser relay | Only when the task must run **in the user's actual live profile** — their extensions or their exact browser identity. A dedicated agent profile (see Authenticated, headless sessions) handles ordinary authed work, but it is still a real logged-in identity: real attribution and side effects apply to it too. |
| `visual-capture` | Producing polished UI evidence for a PR. |

## Test loop

Interact through snapshot refs (`@eN`), not brittle CSS paths. Refs stay stable while the
DOM node survives.

```bash
agent-browser open http://localhost:3000
agent-browser wait --load load           # see note below
agent-browser snapshot                   # - button "Save" [ref=e2]
agent-browser fill @e3 "user@example.com"
agent-browser click @e2
agent-browser wait --text "Saved"
agent-browser get text "#status"
```

> **Always `wait --load` before the first `snapshot`.** `open` returns as soon as
> navigation is accepted, so a snapshot taken immediately after a cold daemon launch can
> come back with an empty `refs` map — every later `@eN` then fails with
> `✗ Element not found: @`. One `wait --load load` removes the race.

Scope work to a session so parallel agents do not fight over one browser:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix my-check)"
agent-browser --session "$SESSION" open http://localhost:3000
```

Close when done: `agent-browser close` (or `close --all`).

### Assertions

`is` and `wait` are the assertion primitives — they set exit codes, so `set -e` scripts
fail correctly:

```bash
agent-browser is visible "#box"        # prints true,  exit 0
agent-browser is visible "#missing"    # prints error, exit 1
agent-browser wait --text "Saved"
agent-browser wait --load networkidle
agent-browser wait --fn "getComputedStyle(document.querySelector('#spinner')).display==='none'"
```

Waiting modes: `<selector>`, `<ms>`, `--text`, `--url`, `--load`, `--fn`, `--download`.
Prefer an explicit `wait` over a sleep; prefer `--text`/`--fn` over polling by hand.
Cap waits with `--timeout <ms>`; the default is 25 s, which is slow to fail in a test loop.

> **Gotcha — do not use `wait <sel> --state hidden`.** Upstream's own help suggests it, but
> the global `--state <file>` flag (storage state) shadows it, so the value is read as a
> filename: `✗ Failed to read state from hidden`. Wait for the negated condition with
> `--fn` instead, as above.

There is no built-in test runner. Compose assertions in a shell script and let exit codes
propagate.

## Unknown flows: explore, then freeze

When a flow's selectors are unknown, a model MAY choose the path **once**, during
authoring. It MUST NOT choose the path at test time.

A snapshot is already an indexed action space, so a decider composes directly:

```js
const snap = JSON.parse(sh(`agent-browser snapshot --json`)).data;   // ~5ms, ~265 chars
const acts = Object.entries(snap.refs).map(([ref, v]) => ({ ref, ...v }));
const { next } = await judge(JSON.stringify({ goal, actions: acts }), {
  next: { type: "choice", instructions: goal,
          criteria: Object.fromEntries(acts.map(a => [a.ref, `${a.role} "${a.name}"`])) },
}).wait();
sh(`agent-browser click @${next.choice}`);   // ~110ms end to end
```

Then **freeze it**: resolve each chosen ref to a stable selector
(`agent-browser get attr data-testid @e4`), write those selectors into a plain script, and
drop the model. Refs are session-scoped and do not survive; selectors do.

> **Never leave a decider in the loop.** It routes around breakage by design. Against a
> page whose pay button had been removed, a Jev-driven run picked the next-best button at
> confidence 1.0 and reported success; the deterministic `is visible` check on the missing
> control failed immediately. Deciders fail silently and confidently — the worst failure
> mode for a test.

Related: `jev-ultrafast` for scripted decider runs, `typesafe-ai` for `judge()` itself.

## Screenshots and visual regression

```bash
agent-browser screenshot shot.png            # viewport
agent-browser screenshot --full page.png     # full page
agent-browser screenshot "#chart" chart.png  # element clip (selector or @ref)
agent-browser screenshot --annotate          # overlay [N] labels matching @eN refs
agent-browser diff screenshot --baseline baseline.png
agent-browser diff snapshot                  # semantic diff vs last snapshot
```

`diff snapshot` is usually the better regression signal: it compares the accessibility
tree, so it ignores antialiasing noise and reports what actually changed.

> **Gotcha — `diff screenshot` exits 0 even when pixels differ.** It prints
> `✗ 4.43% pixels differ` on stdout but still returns 0, so `$?` is not a gate. Read the
> JSON instead — `.data.match` is the boolean verdict:
>
> ```bash
> agent-browser diff screenshot --baseline base.png --json | jq -e '.data.match' >/dev/null \
>   || { echo "visual regression"; exit 1; }
> ```
>
> Companion fields: `.data.mismatchPercentage`, `.data.differentPixels`, `.data.totalPixels`,
> `.data.dimensionMismatch`. (`pixelChangeRatio` belongs to `screenshot --threshold`, not to
> `diff`.)

Other capture notes:

- `--threshold <0-1>` implies `--if-changed`, so unchanged frames are skipped — use it to
  avoid re-reading identical images.
- `--screenshot-format jpeg --screenshot-quality N` for cheaper captures.
- Video recording (`record start|stop`) requires `ffmpeg` on PATH.

## Authenticated, headless sessions

Default auth model: the agent **owns a profile namespace separate from your real Chrome**
and creates/reuses a dedicated profile per identity+service on demand. It never points at
`~/.config/google-chrome`, so your live Chrome is never locked, copied, or hijacked.

> **Never point `--profile` at `~/.config/google-chrome`.** Driving the user's real
> profile mixes agent writes into it, and while Chrome runs the live `SingletonLock`
> makes a second Chrome conflict and hijack the session. The agent root below avoids
> both. (On Linux observed here, Chrome encrypts its cookie store with a libsecret key in
> the shared keyring, so a dedicated profile still decrypts cookies normally — Chrome has
> no app-bound encryption on Linux as it does on Windows. localStorage and IndexedDB sit
> unencrypted in the profile dir.)

### Profile root and slug convention

Key the profile by **identity+service, stable across tasks — not per-task**. A per-task
profile re-logs in every run, which poisons services with login timeouts, device binding,
or step-up 2FA. A persistent per-identity profile stays warm and looks like a real
returning browser — exactly what timeout/cookie-sensitive services expect.

```bash
AB_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/agent-browser/profiles"
slug="github-noel"            # <identity>-<service>, reused across tasks
prof="$AB_ROOT/$slug"
ns="ab-$slug"                 # isolate daemon sockets + restore state per identity
```

### Reuse headless (the common path)

A `--profile` session carries auth in the profile dir, so there is no restored state to
check. Gate it with an explicit post-navigation assertion that fails loudly when the
session logged out, instead of silently scraping a login wall:

```bash
agent-browser --namespace "$ns" --profile "$prof" open https://github.com \
  && agent-browser --namespace "$ns" --profile "$prof" \
       is visible 'a[aria-label*="noel" i]'   # authed-only element; exit 1 if logged out
```

> **`--restore-check-url/-text/-fn` do not gate a `--profile` session.** They validate
> state loaded by `--restore` or `--state`, not a profile dir. See "When replay beats a
> live profile" for their correct use.

### First-time or re-auth — human in the loop, one time

When the profile is new or its check fails, hand off a visible window for the login. The
model never types credentials; you do the password and 2FA by hand.

```bash
agent-browser --namespace "$ns" --profile "$prof" --headed open https://github.com/login
# log in by hand, then confirm the authed state:
agent-browser --namespace "$ns" --profile "$prof" is visible 'a[aria-label*="noel" i]'
# close the headed daemon; auth now persists in $prof for headless reuse:
agent-browser --namespace "$ns" close
```

### Lifecycle and concurrency

- **Persist:** profiles live until you GC them. Delete `$prof` to retire an identity;
  re-run the headful login to refresh a stale one.
- **Concurrency:** one profile is one context. Serialize tasks that share an identity;
  parallelize different identities (distinct `$prof` + `$ns`).
- **Sensitive:** a dedicated profile holds real logged-in sessions. Keep `$AB_ROOT`
  user-private (`chmod 700`), never share, copy, archive, or commit it. Deleting `$prof`
  clears local state only — it does not revoke the server-side session.

### When replay beats a live profile

For read-only scraping or many parallel one-shots, export once and replay instead of
holding a profile — but treat replay as the **fragile** path (cookies go stale, can trip
device/IP binding):

```bash
# with a Chrome started for remote debugging:
agent-browser --auto-connect state save ./auth.json
# --state replay DOES use restore checks — this validates the loaded state:
agent-browser --state ./auth.json --restore-check-text 'Noel' open https://github.com
```

`auth.json` holds live session material — treat it as a credential. Write it to a
user-private path, `chmod 600` it, keep it out of git, and delete it after its short use.
Do not point `--auto-connect` at a profile you must not export. Encrypt state at rest with
`AGENT_BROWSER_ENCRYPTION_KEY` (64-char hex) and expire it with
`AGENT_BROWSER_STATE_EXPIRE_DAYS`. `agent-browser auth save|login` additionally stores
named login profiles for scripted form fills; a human provides the password and 2FA, never
a model. See `agent-browser skills get core --full`.

## Boundaries

- One session is one browser context; do not drive a single session from two concurrent
  tasks.
- Sessions expire like any browser's. Landing on a login page means re-auth, not a bug —
  re-run the `--headed` login for that profile, don't script credentials.
- A passing `wait` proves the condition held, not that the feature works — assert the
  observable result (`get text`, `diff snapshot`) too.
- Diagnose failures with `agent-browser console` and `agent-browser errors` before
  rewriting selectors.
