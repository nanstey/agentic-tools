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
7. Attach the artifacts to the PR (see **Attachment Paths** below) and reference them in the body (hand the body edit to `pr-description`, or update directly when run standalone), keeping each asset under GitHub's ~10 MB inline limit. GitHub has no public REST/`gh` endpoint for body attachments, so upload with the `gh-image` extension (which replicates the web upload flow); hand off only when no GitHub session is available. Do not fabricate attachment URLs.
8. Verify by re-reading the PR body and confirming the new images render (or, on handoff, that the paste-ready block was emitted). On a private repo the `user-attachments` URL inherits repo visibility, so an anonymous fetch returning 404/403 is expected, not a failure.

Stop-and-ask gates: site unreachable, ambiguous before/after refs, capture tooling unavailable (per `visual-capture` preflight), the `gh-image` extension missing (per the gh-image preflight — stop before installing a third-party extension), or an artifact would land in the repo.

## Artifact Handling

- Do **not** add screenshots or videos to the repository. They live in the gitignored `captures/` dir that `visual-capture` produces, and reach the PR as GitHub attachments hosted off-tree.
- Attachment paths, best first:
  1. **`gh image` upload** (preferred, programmatic). The [`gh-image`](https://github.com/drogers0/gh-image) extension (MIT) replicates GitHub's internal web-UI upload endpoint and mints canonical `user-attachments` URLs from the terminal — uploads on private repos stay private. See **gh-image Upload Recipe**.
  2. **User drag-drop** into the PR body/comment when `gh-image` is unavailable or has no usable session.
  3. **Handoff** when neither is possible: emit the artifact paths and a paste-ready `## Screenshots` block, and mark the attach as pending.
- The only exception is a project that already keeps UI assets in a tracked asset dir (e.g. `docs/assets/`) and explicitly wants them committed — otherwise attach, never commit.
- Reference attachments in the PR body only; the branch diff must not gain image/video files.

## gh-image Upload Recipe

Upload artifacts to GitHub and get ready-to-embed `user-attachments` references with the [`gh-image`](https://github.com/drogers0/gh-image) `gh` extension (MIT, © drogers0), then embed them via `gh`. No browser automation, no repo commit, no history churn.

Preflight (gate before any upload; if any check fails, fall back to drag-drop or handoff — do not silently skip):
1. **`gh` present and authenticated:** `gh auth status`. If not, stop and ask the user to `gh auth login` (never run it unattended).
2. **`gh-image` extension present:**
   ```bash
   gh extension list | grep -q 'drogers0/gh-image' && echo present || echo missing
   ```
   If `missing`, **stop and ask before installing** — `gh-image` is a third-party extension (MIT, © drogers0) that authenticates with your full-account `user_session` cookie, so the user should vet/approve it. On approval: `gh extension install drogers0/gh-image`. Never install it unattended.
3. **GitHub session for the upload:** `gh-image` does not use the `gh` token (that endpoint rejects it); it reads the browser `user_session` cookie, or `--token`/`GH_SESSION_TOKEN` (use the env var in CI with a dedicated bot account). A `user_session` cookie grants full account access; treat it like a password and never log it.

1. **Upload** each artifact with an absolute path (`--repo` is inferred inside the repo working dir); capture the printed reference from stdout — `![name](url)` for images, one line per file:
   ```bash
   MD="$(gh image "$PWD/$CAP/02-edit-widget-modal.png" --repo <owner>/<repo>)"
   ```
2. **Embed** into the PR body via `--body-file -` (never inline `--body`, so multi-line/special chars can't break quoting) — or hand the minted markdown to `pr-description`:
   ```bash
   BODY="$(gh pr view <number> --repo <owner>/<repo> --json body -q .body)"
   printf '%s\n\n## Screenshots\n\n%s\n' "$BODY" "$MD" | gh pr edit <number> --repo <owner>/<repo> --body-file -
   ```
3. **Size** if needed by embedding an HTML tag instead of the bare markdown: `<img width="800" alt="..." src="<url>" />`.
4. On `SAML SSO ... not authorized` or `uploadToken not found`, authorize the org session at `https://github.com/orgs/<org>/sso` (write access alone is not enough) and retry; on "no `user_session` cookie", log into a supported browser or set `GH_SESSION_TOKEN`.

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
- Never commit artifacts or force-push a throwaway image commit to host attachments; use `gh-image` (or drag-drop/handoff), never the branch history.
- Never install the `gh-image` extension unattended; it uses a full-account `user_session` cookie, so stop and ask the user to vet and approve the install first.
- Never print, log, or paste a `user_session` cookie / `GH_SESSION_TOKEN`; it grants full account access.
- Never claim a native `gh`/public REST body-attachment endpoint exists, and never fabricate attachment URLs.
- Never overwrite unrelated PR body content while inserting screenshot references.
- If unexpected working tree changes appear while you are working, stop and ask the user how to proceed.

## Output Style

Report applicability verdict, existing-evidence inventory and classification (missing/stale/current), medium chosen and surfaces captured, before/after mapping, how artifacts reached the PR (drag-drop, or a pending handoff with the paste-ready block) confirming none were committed, and the PR body sections updated.
