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
7. Attach the artifacts to the PR (see **Attachment Paths** below) and reference them in the body (hand the body edit to `pr-description`, or update directly when run standalone), keeping each asset under GitHub's ~10 MB inline limit. There is **no** `gh` command or public REST endpoint for PR/issue body attachments; use the browser-upload recipe when a logged-in GitHub profile exists, else hand off. Do not fabricate attachment URLs.
8. Verify by re-reading the PR body and confirming the new images render (or, on handoff, that the paste-ready block was emitted). GitHub rewrites `user-attachments/assets/...` to `private-user-images.githubusercontent.com` on render, so match both forms when asserting the embed loaded.

Stop-and-ask gates: site unreachable, ambiguous before/after refs, capture tooling unavailable (per `visual-capture` preflight), or an artifact would land in the repo.

## Artifact Handling

- Do **not** add screenshots or videos to the repository. They live in the gitignored `captures/` dir that `visual-capture` produces, and reach the PR as GitHub attachments hosted off-tree.
- Attachment paths, best first:
  1. **Browser upload via `playwright-cli`** (preferred, programmatic) when a github.com-authenticated persistent profile exists. GitHub's `user-attachments` CDN is a browser-only flow (session + CSRF) with no `gh`/REST endpoint, but dropping a file into a PR comment textarea mints a **persistent** `user-attachments/assets/` URL *without submitting the comment*. Drive this through `playwright-cli` (never ad-hoc Puppeteer/MCP), reusing a persistent profile the **user** logged into once — the agent never types or handles raw GitHub credentials. See **Browser Upload Recipe**.
  2. **User drag-drop** into the PR body/comment when no authenticated profile is available and logging one in is out of scope.
  3. **Handoff** when neither is possible: emit the artifact paths and a paste-ready `## Screenshots` block, and mark the attach as pending.
  4. **`gh release upload`** only as a last resort — it yields a public `browser_download_url` that renders in markdown, but pollutes Releases; call out the tradeoff and prefer the paths above.
- The only exception is a project that already keeps UI assets in a tracked asset dir (e.g. `docs/assets/`) and explicitly wants them committed — otherwise attach, never commit.
- Reference attachments in the PR body only; the branch diff must not gain image/video files.

## Browser Upload Recipe

Mint persistent attachment URLs by dropping files into a PR comment box via `playwright-cli`, then embed them with `gh` — without ever submitting the comment. Adapted from the community `github-upload-image-to-pr` skill (MIT).

Preconditions: `playwright-cli` available (per `visual-capture` preflight) and a **persistent profile already logged into github.com** (`playwright-cli open --persistent` / `--profile=<dir>`; the user logs in once in that headed profile). If no such profile exists, do not attempt to authenticate — fall back to drag-drop or handoff.

1. **Stage inside the repo, not `/tmp`.** Browser tools only read files under their workspace root, and the staged filename becomes the image alt text. Copy with a meaningful name, e.g. `cp "$CAP/02-edit-widget-modal.png" ./.upload-01-edit-widget-modal.png`. Delete after upload so it is never committed.
2. **Open the PR in the authenticated profile:** `playwright-cli -s=ghup open --persistent "https://github.com/<owner>/<repo>/pull/<number>"`. Take a `snapshot`/`find` to confirm login (handle an SSO "Continue" if shown); if not logged in, stop and fall back.
3. **Find the dropzone**, not the hidden `<input type=file>` (it is `display:none` and absent from the snapshot): `playwright-cli -s=ghup find "Paste, drop, or click to add files"` (or the "Attach files" button). Use its ref.
4. **Upload each file** onto that ref: `playwright-cli -s=ghup drop <ref> --path=./.upload-01-edit-widget-modal.png` (or `upload <path>` if a file chooser opens). Wait ~2–3s between multiple files; upload all into the same textarea before extracting.
5. **Poll the comment textarea** until the placeholder `![Uploading…]()` is replaced by real URLs (1–5s). GitHub inserts an `<img … src="https://github.com/user-attachments/assets/…">` tag (not markdown), so match the asset URL: `playwright-cli --raw -s=ghup eval "JSON.stringify([...(document.getElementById('new_comment_field')||document.querySelector('textarea[id*=comment]')).value.matchAll(/https:\/\/github\.com\/user-attachments\/assets\/[0-9a-fA-F-]+/g)].map(m=>m[0]))"`.
6. **Clear the textarea without submitting** so the draft autosave does not resurface it: `playwright-cli -s=ghup eval "(()=>{const t=document.getElementById('new_comment_field')||document.querySelector('textarea[id*=comment]');t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));return'cleared'})()"`. Never click Comment/Submit.
7. **Embed** the minted URLs into the PR body (hand off to `pr-description`, or `gh pr edit <number> --body-file <file>` when standalone), then `rm ./.upload-*.png` and `playwright-cli -s=ghup close`.

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
- Never type or handle raw GitHub credentials to authenticate a browser; the browser-upload recipe only reuses a persistent profile the user already logged into, and falls back to drag-drop/handoff when none exists.
- Never submit the PR comment used as the upload staging area; clear the textarea instead.
- Never leave the staged `.upload-*` copy tracked or committed; `rm` it after upload.
- Never claim a `gh`/public REST attachment path exists, and never fabricate attachment URLs.
- Never overwrite unrelated PR body content while inserting screenshot references.
- If unexpected working tree changes appear while you are working, stop and ask the user how to proceed.

## Output Style

Report applicability verdict, existing-evidence inventory and classification (missing/stale/current), medium chosen and surfaces captured, before/after mapping, how artifacts reached the PR (drag-drop, or a pending handoff with the paste-ready block) confirming none were committed, and the PR body sections updated.
