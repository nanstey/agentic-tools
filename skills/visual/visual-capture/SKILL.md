---
name: visual-capture
description: Capture screenshots and videos of a running site to document UI work — before/after PR evidence, component crops, and multi-page or scroll tours — by driving the playwright-cli tool. Use when the user wants to show what a UI change looks like, capture before/after evidence for a PR, record a walkthrough, or crop a component.
user-invocable: true
disable-model-invocation: false
---

# Visual Capture

## Core Contract

Produce visual artifacts of a running site to document UI, primarily before/after evidence for PRs.
This skill is the decision and orchestration layer: it decides *what* to capture and *how*, then drives the browser through the companion [`playwright-cli`](../../tools/playwright-cli/SKILL.md) skill for every action — never Playwright MCP, `@playwright/test`, or Puppeteer. Load that skill first; it is the command reference, and the recipes here are capture-specific patterns built on its verbs. The only runtime dependency is the `playwright-cli` tool it wraps (resolved in Preflight).
Choose the medium by change type: static change → screenshot; interaction, scroll, or multi-page flow → video (a `.webm` screencast, transcoded to `.mp4` for PR embedding).
Follow the target repo's `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Base URL of the running site and the routes/selectors of interest.
2. What changed, so the medium and framing fit the change.
3. Before/after scope: which git refs or states to compare (skip for a plain capture).
   For a PR feature walkthrough, prefer a final-state capture from `HEAD` over a commit delta (see `pr-screenshots` Evidence Model).
4. Output/publish target (default a per-branch dir under `captures/`; a project asset dir when embedding).
5. Viewport/theme/device preferences (defaults: desktop `1280x800`, project default theme).

## Prerequisites

- The companion [`playwright-cli`](../../tools/playwright-cli/SKILL.md) skill and the `playwright-cli` tool it drives. Install the tool per that skill's Installation section; the Preflight below is a fast gate.
- For PR-embeddable video: `ffmpeg`, to transcode the recorded `.webm` to `.mp4`. GitHub plays `.mp4`/`.mov` inline reliably; `.webm` rendering is inconsistent (codec-dependent), so the `.mp4` is the artifact you attach to a PR. The Preflight gates on `ffmpeg`. Install if missing: `brew install ffmpeg`, `apt install ffmpeg`, etc.

## Preflight — resolve the tool

Run the bundled `scripts/resolve-tool.sh` (path relative to this skill's directory) to get the invocation; it prints `playwright-cli` or `npx playwright cli`, or exits non-zero when neither is available:

```bash
PW="$(bash scripts/resolve-tool.sh)" || { echo "playwright-cli not found"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (needed for PR-embeddable mp4)"; exit 1; }
```

- `resolve-tool.sh` prints the command → use it as `$PW` for every playwright-cli call. Non-zero exit (neither binary nor npx package) → **stop and ask** before installing. Offer `npm install -g @playwright/cli@latest` (global) or a project-local `@playwright/cli` dev dependency; do not install without approval.
- `ffmpeg` missing → **stop and ask** before installing (see Prerequisites). It is only needed for the `.webm`→`.mp4` transcode; a `.webm`-only capture can proceed without it.

## Bundled scripts

Deterministic helpers so the agent reads a result instead of choosing (paths relative to this skill's directory):

| Script | Purpose |
| --- | --- |
| `scripts/resolve-tool.sh` | Print the playwright-cli invocation (`playwright-cli` or `npx playwright cli`); non-zero exit when absent. |
| `scripts/capture-dir.sh` | Print the per-branch capture dir, reusing or creating `captures/<timestamp>-<slug>`. |
| `scripts/scroll-capture.sh <url> <out.webm> [w] [h] [px_per_sec]` | Record a smooth, correctly-sized full-page scroll (no gray margins) at a constant, relaxed speed via a `run-code` hero script. |
| `scripts/encode-mp4.sh <in> <out.mp4> [crf] [width]` | Transcode a recording to a GitHub-playable H.264 mp4 at native resolution; pass a smaller width/higher crf to shrink for a PR. |

Load the companion [`playwright-cli`](../../tools/playwright-cli/SKILL.md) skill before capturing — it documents every command used below, plus `references/video-recording.md` (recording source) and `references/session-management.md` (named sessions).

## Medium Decision

| Situation | Medium |
| --- | --- |
| Static change: layout, color, spacing, copy, single state | Screenshot (full page) |
| Isolating one element for review or marketing | Screenshot (component crop) |
| Hover/click/form interaction, animation, transition | Video |
| Scroll to reveal a long page | Video |
| Walking a flow across multiple pages | Video |

## Workflow

1. Preflight (above): load the companion `playwright-cli` skill, resolve its tool via `scripts/resolve-tool.sh`, and confirm `ffmpeg` is present (for the mp4 transcode); if either check fails, stop and ask before installing.
2. Pick the medium from the table above; state the choice and why.
3. Confirm the site is reachable at the base URL/port; if not, stop and ask (never capture an error page). If the walkthrough **mutates data** (creates/edits records), require an idempotent, uniquely named demo entity and a cleanup path before recording — prefer application/API cleanup, and scope any direct database cleanup to the generated identifier.
4. Resolve the per-branch capture dir by running the bundled `scripts/capture-dir.sh` and reading its printed path into `$CAP` (deterministic — reuses this branch's dir or creates a new timestamped one), then open a named session and fix capture settings (viewport, theme, device). Reuse the same session across pages.
5. Capture:
   - Screenshots — full page and/or component crops.
   - Videos — record the interaction to `.webm`, then transcode to `.mp4` for PR embedding.
6. Before/after — capture each state with **identical** settings and label old/new. Prefer a base-ref `worktree` (see `worktree` skill) running its own dev server, or a deployed preview, so you don't rebuild in place.
7. Transcode and size for the target; keep the PR mp4 under GitHub's limit (~10 MB).
8. Write outputs under `$CAP` and produce ready-to-paste PR markdown.
9. Close the session — always, including on error (`trap 'playwright-cli -s=capture close' EXIT`).

Stop-and-ask gates: `playwright-cli` tool absent (and install not yet approved), site unreachable, ambiguous before/after refs, or an artifact would land in the repo root.

## playwright-cli Recipes

These use the companion `playwright-cli` skill's commands; see it for full semantics. Recipes write `playwright-cli` for brevity — if Preflight resolved the npx form, substitute `npx playwright cli` (`$PW`). All commands share one named session (`-s=capture`) so state and viewport persist across pages, and write into a per-branch capture dir `$CAP`. Resolve `$CAP` deterministically by running the bundled `scripts/capture-dir.sh` (path relative to this skill's directory) and reading its printed path — it reuses this branch's existing dir or creates a new timestamped one, so the agent never picks the path by hand:

```bash
CAP="$(bash scripts/capture-dir.sh)"   # e.g. captures/20260713-142530-feat-visual-capture
mkdir -p "$CAP/components"
```

Screenshots (full page and component crop). Use `snapshot`/`find` to get an element ref, then screenshot it; `highlight` to emphasize a component before the shot:

```bash
playwright-cli -s=capture open "$BASE_URL" --browser=chrome
playwright-cli -s=capture resize 1280 800
playwright-cli -s=capture goto "$BASE_URL/pricing"
playwright-cli -s=capture screenshot --filename="$CAP/pricing.png"            # full page
playwright-cli -s=capture screenshot "header nav" --filename="$CAP/nav.png"   # crop by selector
playwright-cli -s=capture find "Add to cart"                                 # locate a ref
playwright-cli -s=capture highlight e12 --style="outline: 3px solid #f0f"     # optional emphasis
playwright-cli -s=capture screenshot e12 --filename="$CAP/components/cta.png" # crop by ref
playwright-cli -s=capture close
```

Video (interaction / scroll / multi-page). **Record at a size equal to the viewport** — bare `video-start` defaults to ~800×450 and letterboxes the page with gray margins. Drive motion from one `run-code` hero script (controlled pauses, time-based scrolling), never a fast `mouse.wheel` loop. See the `playwright-cli` skill's `references/video-recording.md`.

Common case — a smooth full-page scroll — use the bundled helper (it sizes the video to the viewport and scrolls at a constant, relaxed speed regardless of page length; lower `px_per_sec` for an even slower pace):

```bash
bash scripts/scroll-capture.sh "$BASE_URL/pricing" "$CAP/tour.webm"          # 1280x800 @ 400 px/s
# slower/faster: pass px/s as the 5th arg, e.g. ... "$CAP/tour.webm" 1280 800 300
```

Richer tours (clicks, chapters, highlights): write your own hero script that calls `page.screencast.start({ path, size: { width, height } })` with size == viewport, paces with `waitForTimeout`/`pressSequentially({ delay })` and a time-based scroll, then `page.screencast.stop()`; run it via `playwright-cli run-code --filename=...`. `run-code` has no `process`/env and no `require`/`import`, so bake values into the script.

Always wrap the recording in `try/finally` so a mid-flow failure still stops the screencast (no orphaned/partial recording), and explicitly dismiss any open overlay (combobox portal, popover, menu) before clicking a form submit control — an open portal can intercept the click and silently break the flow:

```js
await page.screencast.start({ path, size: { width: 1280, height: 800 } });
try {
  // navigate, act, and after a multi-select: press Escape (or a verified close)
  // to dismiss the combobox portal before clicking Save/Create, then wait for settled UI.
} finally {
  await page.screencast.stop();
}
```

Transcode `.webm` → `.mp4` with `scripts/encode-mp4.sh` for a PR-embeddable clip (H.264/yuv420p, GitHub plays it inline; `.webm` embedding is unreliable). Native resolution by default; raise `crf` or pass a smaller width to shrink under GitHub's ~10 MB limit:

```bash
bash scripts/encode-mp4.sh "$CAP/tour.webm" "$CAP/tour.mp4"             # native, crf 23
# smaller PR file: bash scripts/encode-mp4.sh "$CAP/tour.webm" "$CAP/tour.mp4" 28 1000
```

Before/after pair (identical settings both runs):

```bash
mkdir -p "$CAP/before" "$CAP/after"
# BEFORE — base ref in a parallel worktree on its own port
playwright-cli -s=capture goto "$BEFORE_URL/pricing"
playwright-cli -s=capture screenshot --filename="$CAP/before/pricing.png"
# AFTER — current branch
playwright-cli -s=capture goto "$AFTER_URL/pricing"
playwright-cli -s=capture screenshot --filename="$CAP/after/pricing.png"
```

Responsive/mobile: `playwright-cli -s=capture open "$BASE_URL" --device="iPhone 15"` (or `--mobile`).

## Output Layout

Captures are scoped per branch so runs on different branches never mix. Each dir is `<timestamp>-<branch-slug>`; the timestamp prefix sorts newest-last for easy "most recent" lookup, and re-running on the same branch reuses its existing dir. `scripts/capture-dir.sh` computes the path (branch via git, slugified) and is the single source of truth — the agent runs it rather than choosing a directory.

```
captures/                                  # gitignored; add to the target repo's .gitignore
└── 20260713-142530-feat-visual-capture/   # <timestamp>-<branch-slug>; reused on re-run
    ├── before/                            # before/after pairs
    ├── after/
    ├── <route>.png                        # full-page screenshots
    ├── components/                        # element crops
    ├── tour.webm                          # recording (high quality, small; primary artifact)
    └── tour.mp4                           # transcoded, PR-embeddable
```

## Gotchas

- **Gray margins in the video.** Bare `video-start` records at ~800×450 regardless of `resize`, so the page is fit into that canvas with gray padding. Record via `page.screencast.start({ size })` (or `scroll-capture.sh`) with size equal to the viewport.
- **Long dead time before motion, or scroll flies by.** Don't drive a recording with many separate CLI calls or a `mouse.wheel` loop. Use one `run-code` hero script with `waitForTimeout` pacing. Scroll at a constant speed (px/second) rather than easing over a fixed duration — eased/fixed-duration scrolls spike to ~2× speed mid-page and feel fast on tall pages.
- **Video format for PRs.** The `.webm` screencast is high quality and small, but GitHub's inline playback of `.webm` is inconsistent (codec-dependent). Transcode to `.mp4` (H.264/yuv420p, via `encode-mp4.sh`) for the artifact you attach to a PR. Keep it under GitHub's ~10 MB attachment limit — raise `crf` or reduce width for long/photo-heavy scrolls.
- **`run-code` sandbox.** No `process`/env, no `require`/`import`; it evaluates a single function expression. Interpolate values into the script (as the helpers do).
- **Overlay intercepts submit click.** After a multi-select, an open combobox/portal can sit over the form's submit button and swallow the click. Dismiss it (Escape or a verified close action) and wait for it to detach before clicking Save/Create.
- **Orphaned recording on failure.** Always `page.screencast.start()` inside `try` with `stop()` in `finally`, so a mid-flow error still finalizes the file instead of leaving a partial/locked recording.

## PR Integration

- Emit a ready-to-paste block for the PR body (hand off to `pr-description`):
  - Before/after in a two-column table, or wrapped in `<details><summary>Screenshots</summary>…</details>`.
- Attach the `.mp4` via the GitHub UI (drag-drop into the PR body or a comment); GitHub hosts it and renders an inline player. Do not rely on `.webm` embedding. Screenshots can be committed under the project's asset dir (e.g. `public/`, `docs/assets/`) and linked, or attached the same way.
- Keep each asset under GitHub's per-file limit (~10 MB free / 100 MB paid); raise `crf`/reduce width to fit.

## Composition

- Pair with the `worktree` skill to run the base ref for the "before" state without disturbing the working tree.
- Feed the emitted markdown to `pr-description`; within the `pr` workflow, capture before pushing so the description carries the evidence.

## Safety Rules

- Never commit captured artifacts to the repo root or leave large frame/video dumps tracked; write to a gitignored `captures/` dir.
- Never leave an orphaned browser; close the session at the end and on error.
- Never vary viewport, theme, or device between before and after — mismatched settings invalidate the comparison.
- Never fabricate a state; capture the actual before and after.
- Never leave a recording unstopped on error; start the screencast in `try` and stop it in `finally`.
- Never leave demo data behind; when a walkthrough mutates data, use a uniquely named entity and clean it up afterward.
- Never bypass the `playwright-cli` skill with ad-hoc Puppeteer, `@playwright/test`, or MCP.
- Never commit oversized assets; downscale and trim to PR-friendly sizes.
- If the site or a route is unreachable, stop and ask rather than capturing a blank or error page.

## Output Style

Report the medium chosen and why, per-artifact paths, the viewport/theme/device used, before/after mapping, transcoded mp4 size(s), the ready-to-paste PR markdown, and confirmation the session was closed.
