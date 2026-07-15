---
name: visual-capture
description: Capture screenshots and GIFs of a running site to document UI work — before/after PR evidence, component crops, and multi-page or scroll tours — by driving the playwright-cli tool. Use when the user wants to show what a UI change looks like, capture before/after evidence for a PR, record a walkthrough, or crop a component.
user-invocable: true
disable-model-invocation: false
---

# Visual Capture

## Core Contract

Produce visual artifacts of a running site to document UI, primarily before/after evidence for PRs.
This skill is the decision and orchestration layer: it decides *what* to capture and *how*, then drives the browser through the companion [`playwright-cli`](../../tools/playwright-cli/SKILL.md) skill for every action — never Playwright MCP, `@playwright/test`, or Puppeteer. Load that skill first; it is the command reference, and the recipes here are capture-specific patterns built on its verbs. The only runtime dependency is the `playwright-cli` tool it wraps (resolved in Preflight).
Choose the medium by change type: static change → screenshot; interaction, scroll, or multi-page flow → GIF.
Follow the target repo's `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. Base URL of the running site and the routes/selectors of interest.
2. What changed, so the medium and framing fit the change.
3. Before/after scope: which git refs or states to compare (skip for a plain capture).
4. Output/publish target (default a per-branch dir under `captures/`; a project asset dir when embedding).
5. Viewport/theme/device preferences (defaults: desktop `1280x800`, project default theme).

## Prerequisites

- The companion [`playwright-cli`](../../tools/playwright-cli/SKILL.md) skill and the `playwright-cli` tool it drives. Install the tool per that skill's Installation section; the Preflight below is a fast gate.
- For GIFs: a `.webm`→`.gif` encoder. `gifski` is required for good quality/size; `ffmpeg` is an accepted fallback. The Preflight gates on this. Install if missing: `brew install gifski`, `cargo install gifski`, or the prebuilt npm binary (`npm i -g gifski` then symlink `$(npm root -g)/gifski/bin/<platform>/gifski` onto your PATH).

## Preflight — resolve the tool

Run the bundled `scripts/resolve-tool.sh` (path relative to this skill's directory) to get the invocation; it prints `playwright-cli` or `npx playwright cli`, or exits non-zero when neither is available:

```bash
PW="$(bash scripts/resolve-tool.sh)"  || { echo "playwright-cli not found"; exit 1; }
ENC="$(bash scripts/check-encoder.sh)" || { echo "no GIF encoder (gifski/ffmpeg)"; exit 1; }
```

- `resolve-tool.sh` prints the command → use it as `$PW` for every playwright-cli call. Non-zero exit (neither binary nor npx package) → **stop and ask** before installing. Offer `npm install -g @playwright/cli@latest` (global) or a project-local `@playwright/cli` dev dependency; do not install without approval.
- `check-encoder.sh` prints `gifski` or `ffmpeg`. Non-zero exit (neither present) → **stop and ask**; recommend installing `gifski` (see Prerequisites). Do not install without approval.

## Bundled scripts

Deterministic helpers so the agent reads a result instead of choosing (paths relative to this skill's directory):

| Script | Purpose |
| --- | --- |
| `scripts/resolve-tool.sh` | Print the playwright-cli invocation (`playwright-cli` or `npx playwright cli`); non-zero exit when absent. |
| `scripts/check-encoder.sh` | Print the GIF encoder (`gifski` preferred, else `ffmpeg`); non-zero exit when neither is present. |
| `scripts/capture-dir.sh` | Print the per-branch capture dir, reusing or creating `captures/<timestamp>-<slug>`. |
| `scripts/encode-gif.sh <in> <out.gif> [fps] [width]` | Encode a recording to a GIF at native resolution (gifski, else ffmpeg palette); pass a smaller width to shrink for a PR. |
| `scripts/scroll-capture.sh <url> <out.webm> [w] [h] [px_per_sec]` | Record a smooth, correctly-sized full-page scroll (no gray margins) at a constant, relaxed speed via a `run-code` hero script. |

Load the companion [`playwright-cli`](../../tools/playwright-cli/SKILL.md) skill before capturing — it documents every command used below, plus `references/video-recording.md` (GIF source) and `references/session-management.md` (named sessions).

## Medium Decision

| Situation | Medium |
| --- | --- |
| Static change: layout, color, spacing, copy, single state | Screenshot (full page) |
| Isolating one element for review or marketing | Screenshot (component crop) |
| Hover/click/form interaction, animation, transition | GIF |
| Scroll to reveal a long page | GIF |
| Walking a flow across multiple pages | GIF |

## Workflow

1. Preflight (above): load the companion `playwright-cli` skill, resolve its tool via `scripts/resolve-tool.sh`, and confirm a GIF encoder via `scripts/check-encoder.sh`; if either exits non-zero, stop and ask before installing.
2. Pick the medium from the table above; state the choice and why.
3. Confirm the site is reachable at the base URL/port; if not, stop and ask (never capture an error page).
4. Resolve the per-branch capture dir by running the bundled `scripts/capture-dir.sh` and reading its printed path into `$CAP` (deterministic — reuses this branch's dir or creates a new timestamped one), then open a named session and fix capture settings (viewport, theme, device). Reuse the same session across pages.
5. Capture:
   - Screenshots — full page and/or component crops.
   - GIFs — record native video across the interaction, then encode to `.gif`.
6. Before/after — capture each state with **identical** settings and label old/new. Prefer a base-ref `worktree` (see `worktree` skill) running its own dev server, or a deployed preview, so you don't rebuild in place.
7. Encode and size for the target; keep PR GIFs small.
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

GIF via recorded video. **Record at a size equal to the viewport** — bare `video-start` defaults to ~800×450 and letterboxes the page with gray margins. Drive motion from one `run-code` hero script (controlled pauses, time-based scrolling), never a fast `mouse.wheel` loop. See the `playwright-cli` skill's `references/video-recording.md`.

Common case — a smooth full-page scroll — use the bundled helper (it sizes the video to the viewport and scrolls at a constant, relaxed speed regardless of page length; lower `px_per_sec` for an even slower pace):

```bash
bash scripts/scroll-capture.sh "$BASE_URL/pricing" "$CAP/tour.webm"          # 1280x800 @ 400 px/s
# slower/faster: pass px/s as the 5th arg, e.g. ... "$CAP/tour.webm" 1280 800 300
```

Richer tours (clicks, chapters, highlights): write your own hero script that calls `page.screencast.start({ path, size: { width, height } })` with size == viewport, paces with `waitForTimeout`/`pressSequentially({ delay })` and a time-based scroll, then `page.screencast.stop()`; run it via `playwright-cli run-code --filename=...`. `run-code` has no `process`/env and no `require`/`import`, so bake values into the script.

Encode `.webm` → `.gif` with `scripts/encode-gif.sh` (prefers gifski, falls back to a two-pass ffmpeg palette). It keeps native resolution by default for crisp output; pass a smaller width only to shrink a long scroll for a PR:

```bash
bash scripts/encode-gif.sh "$CAP/tour.webm" "$CAP/tour.gif"            # native width, crisp
# smaller PR-friendly file: bash scripts/encode-gif.sh "$CAP/tour.webm" "$CAP/tour.gif" 12 1000
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
    ├── tour.webm                          # raw recording (delete when done)
    └── tour.gif                           # encoded, PR-ready
```

## Gotchas

- **Gray margins in the video/GIF.** Bare `video-start` records at ~800×450 regardless of `resize`, so the page is fit into that canvas with gray padding. Record via `page.screencast.start({ size })` (or `scroll-capture.sh`) with size equal to the viewport.
- **Long dead time before motion, or scroll flies by.** Don't drive a recording with many separate CLI calls or a `mouse.wheel` loop. Use one `run-code` hero script with `waitForTimeout` pacing. Scroll at a constant speed (px/second) rather than easing over a fixed duration — eased/fixed-duration scrolls spike to ~2× speed mid-page and feel fast on tall pages.
- **Scroll-GIF file size.** A full-page scroll at native resolution is large (tens of MB); photo-heavy pages stay large even with `gifski`, since GIF encodes photos poorly. The reliable size levers are a smaller `encode-gif.sh` width and lower fps (GitHub caps GIF attachments ~10 MB); prefer a short/narrower clip, or attach the `.webm` as a video, when a full-res photo scroll is too big.
- **`run-code` sandbox.** No `process`/env, no `require`/`import`; it evaluates a single function expression. Interpolate values into the script (as the helpers do).

## PR Integration

- Emit a ready-to-paste block for the PR body (hand off to `pr-description`):
  - Before/after in a two-column table, or wrapped in `<details><summary>Screenshots</summary>…</details>`.
- Reference committed asset paths, not local absolute paths. To render in a PR body, either commit small assets under the project's asset dir (e.g. `public/`, `docs/assets/`) and link them, or attach via the GitHub UI.
- Keep each asset well under GitHub's per-file limit; target a few MB or less for GIFs so they render smoothly.

## Composition

- Pair with the `worktree` skill to run the base ref for the "before" state without disturbing the working tree.
- Feed the emitted markdown to `pr-description`; within the `pr` workflow, capture before pushing so the description carries the evidence.

## Safety Rules

- Never commit captured artifacts to the repo root or leave large frame/video dumps tracked; write to a gitignored `captures/` dir.
- Never leave an orphaned browser; close the session at the end and on error.
- Never vary viewport, theme, or device between before and after — mismatched settings invalidate the comparison.
- Never fabricate a state; capture the actual before and after.
- Never bypass the `playwright-cli` skill with ad-hoc Puppeteer, `@playwright/test`, or MCP.
- Never commit oversized assets; downscale and trim to PR-friendly sizes.
- If the site or a route is unreachable, stop and ask rather than capturing a blank or error page.

## Output Style

Report the medium chosen and why, per-artifact paths, the viewport/theme/device used, before/after mapping, encoded GIF size(s), the ready-to-paste PR markdown, and confirmation the session was closed.
