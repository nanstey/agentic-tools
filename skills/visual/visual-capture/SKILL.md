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
- For GIFs: `gifski` (preferred) or `ffmpeg` to convert recorded `.webm` to `.gif`.

## Preflight — resolve the tool

Run this first and reuse the resolved command (shown as `playwright-cli` in the recipes):

```bash
if command -v playwright-cli >/dev/null 2>&1; then PW="playwright-cli";
elif npx --no-install playwright --version >/dev/null 2>&1; then PW="npx playwright cli";
else PW=""; fi
echo "${PW:-MISSING}"
```

- Global binary found → use `playwright-cli`.
- Only the local package found → use `npx playwright cli` for every command.
- Neither → **stop and ask** before installing. Offer `npm install -g @playwright/cli@latest` (global) or a project-local `@playwright/cli` dev dependency; do not install without approval.

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

1. Preflight (above): load the companion `playwright-cli` skill and resolve its tool; if neither the binary nor the npx package is available, stop and ask before installing.
2. Pick the medium from the table above; state the choice and why.
3. Confirm the site is reachable at the base URL/port; if not, stop and ask (never capture an error page).
4. Resolve the per-branch capture dir `$CAP` (reuse this branch's existing dir, else create a new timestamped one — see Recipes), then open a named session and fix capture settings (viewport, theme, device). Reuse the same session across pages.
5. Capture:
   - Screenshots — full page and/or component crops.
   - GIFs — record native video across the interaction, then encode to `.gif`.
6. Before/after — capture each state with **identical** settings and label old/new. Prefer a base-ref `worktree` (see `worktree` skill) running its own dev server, or a deployed preview, so you don't rebuild in place.
7. Encode and size for the target; keep PR GIFs small.
8. Write outputs under `$CAP` and produce ready-to-paste PR markdown.
9. Close the session — always, including on error (`trap 'playwright-cli -s=capture close' EXIT`).

Stop-and-ask gates: `playwright-cli` tool absent (and install not yet approved), site unreachable, ambiguous before/after refs, or an artifact would land in the repo root.

## playwright-cli Recipes

These use the companion `playwright-cli` skill's commands; see it for full semantics. Recipes write `playwright-cli` for brevity — if Preflight resolved the npx form, substitute `npx playwright cli` (`$PW`). All commands share one named session (`-s=capture`) so state and viewport persist across pages, and write into a per-branch capture dir `$CAP` resolved once up front:

```bash
BRANCH_SLUG=$(git rev-parse --abbrev-ref HEAD | tr '/' '-' | tr -cs 'A-Za-z0-9-' '-')
CAP=$(ls -1d captures/*-"$BRANCH_SLUG" 2>/dev/null | sort | tail -1)   # reuse this branch's latest dir
[ -n "$CAP" ] || CAP="captures/$(date +%Y%m%d-%H%M%S)-$BRANCH_SLUG"    # else start a new timestamped one
mkdir -p "$CAP" "$CAP/components"
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

GIF via native video (interaction / scroll / multi-page). Get refs from `snapshot` first; use `video-chapter` to label each leg of a multi-page tour and `video-show-actions` for on-frame callouts:

```bash
playwright-cli -s=capture open "$BASE_URL" --browser=chrome
playwright-cli -s=capture resize 1280 800
playwright-cli -s=capture video-start "$CAP/tour.webm"
playwright-cli -s=capture video-show-actions --duration=600            # optional action callouts
playwright-cli -s=capture snapshot                                     # get refs (e.g. e15)
playwright-cli -s=capture video-chapter "Home"
playwright-cli -s=capture click e15
playwright-cli -s=capture run-code "async page => { for (let y=0; y<3000; y+=400){ await page.mouse.wheel(0,400); await page.waitForTimeout(120); } }"
playwright-cli -s=capture video-chapter "Features"
playwright-cli -s=capture goto "$BASE_URL/features"
playwright-cli -s=capture video-stop
playwright-cli -s=capture close
```

Encode `.webm` → `.gif` (high-quality ffmpeg palette; keep width ~800–1100, fps 8–15):

```bash
ffmpeg -i "$CAP/tour.webm" -vf "fps=12,scale=1000:-1:flags=lanczos,palettegen" "$CAP/palette.png"
ffmpeg -i "$CAP/tour.webm" -i "$CAP/palette.png" \
  -lavfi "fps=12,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse" "$CAP/tour.gif"
# gifski alternative (higher quality, larger): gifski --fps 12 --width 1000 -o "$CAP/tour.gif" "$CAP/tour.webm"
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

Captures are scoped per branch so runs on different branches never mix. Each dir is `<timestamp>-<branch-slug>`; the timestamp prefix sorts newest-last for easy "most recent" lookup, and re-running on the same branch reuses its existing dir (see the `$CAP` resolver in Recipes).

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
