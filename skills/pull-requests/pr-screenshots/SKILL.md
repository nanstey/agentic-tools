---
name: pr-screenshots
description: Keeps a PR's screenshots and UI clips in sync with the current UI implementation, capturing or refreshing them when the branch changes user-facing UI. Use when a PR touches UI and its visual evidence may be missing or stale.
user-invocable: true
disable-model-invocation: false
---

# PR Screenshots

## Core Contract

Ensure the PR's visual evidence matches the current UI implementation on the branch.
Decide whether screenshots/clips are *applicable*, detect *stale or missing* evidence, and refresh it by delegating capture to the [`visual-capture`](../../visual/visual-capture/SKILL.md) skill (which drives `playwright-cli`).
Do the decision and PR-body wiring here; never capture with ad-hoc tooling.
Default tool for PR reads/writes is `gh`. Follow the target repo's `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL if provided, else current branch (resolve via `pr-info`).
2. The branch changeset (three-dot diff) to judge whether UI changed.
3. A runnable site/dev server for the branch (base URL/port) when capture is needed.
4. Publish target for artifacts (default: attach to the PR via GitHub upload; never the repo root).

## Applicability

Screenshots are applicable only when the branch changes user-facing UI. Judge from the three-dot diff `git diff base...HEAD`:

- **Applicable**: changes to components/views/templates/styles/pages, or files under UI dirs (e.g. `components/`, `pages/`, `app/`, `src/ui/`, `*.tsx/.jsx/.vue/.svelte`, `*.css/.scss`).
- **Not applicable**: backend-only, config, docs, tests, tooling, or non-visual refactors.

If not applicable, report "no UI change — screenshots not required" and stop without capturing.

## Workflow

1. Resolve the PR via `pr-info`; if no PR exists, stop and suggest `pr-create`.
2. Analyze the three-dot diff (`git diff base...HEAD`, `git diff --stat base...HEAD`) and decide applicability above. If not applicable, stop with that outcome.
3. Read the current PR body and inventory existing visual evidence: embedded images, attached `user-images.githubusercontent.com` / `github.com/user-attachments` links, and any `<details>Screenshots</details>` blocks.
4. Classify the evidence:
   - **Missing**: UI changed but the body has no relevant screenshot/clip.
   - **Stale**: evidence exists but predates UI-affecting commits, or clearly shows a superseded UI (changed routes/components since the asset was added).
   - **Current**: evidence covers the changed surfaces and postdates the latest UI-affecting commit.
   If **Current**, report that and stop — do not recapture.
5. For missing/stale evidence, confirm the branch's site is reachable at the base URL/port; if not, stop and ask (never capture an error page).
6. Delegate capture to `visual-capture`: pick the medium (static → screenshot, interaction/scroll/flow → video), capture the changed routes/components, and — when the change modifies existing UI — capture a before/after pair using a base-ref `worktree`.
7. Attach the artifacts to the PR by GitHub upload and reference them in the body (hand the body edit to `pr-description`, or update directly when run standalone). Keep each asset under GitHub's ~10 MB inline limit.
8. Verify by re-reading the PR body and confirming the new links render.

Stop-and-ask gates: site unreachable, ambiguous before/after refs, capture tooling unavailable (per `visual-capture` preflight), or an artifact would land in the repo.

## Artifact Handling

- Do **not** add screenshots or videos to the repository. They live in the gitignored `captures/` dir that `visual-capture` produces, and reach the PR via GitHub's attachment upload (drag-drop into the body/comment, or the REST upload), which hosts them off-tree.
- The only exception is a project that already keeps UI assets in a tracked asset dir (e.g. `docs/assets/`) and explicitly wants them committed — otherwise attach, never commit.
- Reference attachments in the PR body only; the branch diff must not gain image/video files.

## Composition

- Triggered standalone (`/pr-screenshots`) or as a step of `pr-description`, which calls this skill before finalizing the body so UI PRs carry current evidence.
- Within the `pr` workflow, run before the description sync so the refreshed evidence is wired into the final body.
- Delegates all capture to `visual-capture`; pairs with `worktree` for the before state.

## Safety Rules

- Never commit captured screenshots or videos to the repo (including the repo root); attach them to the PR instead.
- Never add image/video files to the branch changeset to satisfy this skill.
- Never recapture when existing evidence already reflects the current UI.
- Never capture a blank or error page; if the site is unreachable, stop and ask.
- Never vary viewport/theme/device between before and after (enforced by `visual-capture`).
- Never bypass `visual-capture`/`playwright-cli` with ad-hoc Puppeteer, `@playwright/test`, or MCP.
- Never overwrite unrelated PR body content while inserting screenshot references.
- If unexpected working tree changes appear while you are working, stop and ask the user how to proceed.

## Output Style

Report applicability verdict, existing-evidence inventory and classification (missing/stale/current), medium chosen and surfaces captured, before/after mapping, where artifacts were attached (confirming none were committed), and the PR body sections updated.
