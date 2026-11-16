# PR Screenshots

## Core Contract

Ensure the PR's visual evidence matches the current UI implementation on the branch.
Decide whether screenshots/clips are *applicable*, detect *stale or missing* evidence, and refresh it by delegating capture to the `visual-capture` skill (which drives `playwright-cli`).
Do the decision and PR-body wiring here; never capture with ad-hoc tooling.
Default tool for PR reads/writes is `gh`. Follow the target repo's `CLAUDE.md` / `AGENTS.md` on conflict.

## Required Inputs

1. PR URL if provided, else current branch (resolve via `/pr info`).
2. The branch changeset (`/pr info`'s authoritative comparison) to judge whether UI changed.
3. A runnable site/dev server for the branch (base URL/port) when capture is needed.
4. Artifact publish outcome: a completed native `gh pr edit --body-file <temp> --attach <path>` edit, or a pending handoff with artifact paths and paste-ready local Markdown (never the repo root).

## Evidence Model

Default to **PR-scoped, final-state** evidence: every artifact in the PR body should be captured from final `HEAD` and demonstrate the capabilities the PR introduces, not a commit-to-commit delta. Before capture, sketch a short evidence matrix so the artifacts cover the PR, not an arbitrary diff:

| PR capability | Final-state screenshot/video moment |
| --- | --- |
| … | … |

Use a before/after pair **only** when the PR's review question is explicitly a visual replacement or regression. When a comparison is genuinely useful, label the exact refs — e.g. `Prior commit (abc123)` and `Final branch` — never a bare `Before`/`After`, which misleads on a feature PR or a refresh after an incremental commit. When the body narrates such a comparison, frame it as Before, After, Bridge (`before-after-bridge`): the prior state, the improved state, then how the change got there.

## Applicability

Screenshots are applicable only when the branch changes user-facing UI. Judge from `/pr info`'s authoritative comparison (`git diff <baseRefOid>..<headRefOid>`):

- **Applicable**: changes to components/views/templates/styles/pages, or files under UI dirs (e.g. `components/`, `pages/`, `app/`, `src/ui/`, `*.tsx/.jsx/.vue/.svelte`, `*.css/.scss`).
- **Not applicable**: backend-only, config, docs, tests, tooling, or non-visual refactors.

If not applicable, report "no UI change — screenshots not required" and stop without capturing.

## Workflow

1. Resolve the PR via `/pr info`; if no PR exists, stop and suggest `/pr create`.
2. Analyze the PR diff (`git diff <baseRefOid>..<headRefOid>`, `git diff --stat <baseRefOid>..<headRefOid>`) and decide applicability above. If not applicable, stop with that outcome.
3. Read the current PR body and inventory existing visual evidence: embedded images, attached `user-images.githubusercontent.com` / `github.com/user-attachments` links, and any `<details>Screenshots</details>` blocks.
4. Classify the evidence:
   - **Missing**: UI changed but the body has no relevant screenshot/clip.
   - **Stale**: evidence exists but predates UI-affecting commits, or clearly shows a superseded UI (changed routes/components since the asset was added).
   - **Current**: evidence covers the changed surfaces and postdates the latest UI-affecting commit.
   If **Current**, report that and stop — do not recapture.
5. For missing/stale evidence, confirm the branch's site is reachable at the base URL/port; if not, stop as blocked (never capture an error page).
6. Build the **evidence matrix** (see **Evidence Model**), then delegate capture to `visual-capture`: pick the medium (static → screenshot, interaction/scroll/flow → video) and capture each matrix row from final `HEAD`. Capture a before/after pair (via a base-ref `worktree`) only when the PR's review question is an explicit visual replacement/regression, and label the exact refs.
7. Build the complete intended body and attach the artifacts with the single native edit in **Native Attach Recipe**. The body preserves unrelated content and references every local capture path once with alt text. Do not fabricate attachment URLs.
8. After every attempted native attach command, re-read the body and inventory hosted attachment URLs and remaining local capture paths. A nonzero exit may have updated the PR with successful uploads; report that partial state and do not blindly retry, because a retry can duplicate uploads. If a non-safety preflight failed, instead confirm the pending handoff includes validated artifact paths and a paste-ready block. An unsafe path stops without a handoff. On a private repo, an anonymous fetch returning 404/403 for a hosted attachment URL is expected, not a failure.

Blocking gates: `gh` older than 2.99.0, missing GitHub authentication or push access, a non-`github.com` host (GHES is unsupported), more than 50 attachment files, an unsafe attachment path, site unreachable, ambiguous before/after refs, capture tooling unavailable (per `visual-capture` preflight), or an artifact landing in the repo. A failed native-attach preflight takes the handoff path, except an unsafe path stops without a handoff; never make a partial attach attempt.

## Artifact Handling

- Do **not** add screenshots or videos to the repository. They live in the gitignored `captures/` dir that `visual-capture` produces, and reach the PR as GitHub attachments hosted off-tree.
- Attachment paths, best first:
  1. **Native `gh pr edit --attach`** (preferred, programmatic). It uploads each local capture while rewriting the PR body in one operation. See **Native Attach Recipe**.
  2. **Handoff when a non-safety preflight fails.** Emit validated artifact paths plus a paste-ready `## Screenshots` block containing each validated local path and its alt text. Mark the attach as pending. The user may manually drag and drop those files into the PR body as the fallback step; do not run any `--attach` flags. An unsafe path stops without a handoff.
- The only exception is a project that already keeps UI assets in a tracked asset dir (e.g. `docs/assets/`) and explicitly wants them committed — otherwise attach, never commit.
- Reference attachments in the PR body only; the branch diff must not gain image/video files.

## Native Attach Recipe

Use one native attachment-bearing body edit. It uploads the assets and rewrites their local Markdown references to hosted URLs without adding body or media files to the branch.

**Preflight.** Run every gate before generating an attachment edit. Any non-safety failure takes the pending-handoff path in **Artifact Handling**; an unsafe path stops without a handoff. Never submit a partial `--attach` attempt.

| Gate | Check | Failure outcome |
| --- | --- | --- |
| GitHub CLI version | `gh --version` reports version 2.99.0 or later | Emit paths and paste-ready Markdown; mark attach pending. |
| GitHub authentication | `gh auth status` exits successfully | Emit paths and paste-ready Markdown; mark attach pending. |
| Push access | `gh repo view --json viewerPermission -q .viewerPermission` reports `ADMIN`, `MAINTAIN`, or `WRITE` | Emit paths and paste-ready Markdown; mark attach pending. |
| Public GitHub host | `gh repo view --json url -q .url` resolves to `https://github.com/...` | Emit paths and paste-ready Markdown; mark attach pending. GHES is unsupported. |
| Attachment inventory and count | After body preparation, the final body has an inventory of every local image/video path. Each entry is a relative `captures/...` path to a regular file; neither it nor any parent directory is a symlink. The `captures/` tree has no tracked files. Pass each entry exactly once with `--attach`, with at most 50 entries. | For an unsafe path, stop and report it without including it in a handoff. Otherwise emit only validated paths and paste-ready Markdown; mark attach pending. |

**Prepare the body and assets.**

1. Create a private temporary workspace, register recursive cleanup immediately, and serialize the existing body directly to a file. `jq -j` writes the JSON string without adding or removing a final newline:
   ```bash
   TMP_DIR="$(mktemp -d)"
   trap 'rm -rf "$TMP_DIR"' EXIT
   BODY_FILE="$TMP_DIR/body.md"
   gh pr view <number> --json body | jq -j '.body' > "$BODY_FILE"
   ```
2. Use a structured body-file editor to insert or refresh only the managed `## Screenshots` evidence section in `"$BODY_FILE"`. It must preserve every byte outside that section's exact byte range; when the section is absent, it must insert the new section without rewriting existing body bytes. Build the section from the local capture paths, with descriptive Markdown alt text. Do not read the body into a shell variable or rewrite it with shell substitution.
3. Inspect the complete final `"$BODY_FILE"`, not only the refreshed `## Screenshots` section or newly captured files. Inventory every local image/video path it references, while preserving already-hosted URLs. Only accept a literal relative `captures/...` path as an inventory entry; reject absolute paths and paths containing `.` or `..` components. Run `gh pr edit` from the repository root and retain this exact literal string for its `--attach` flag, so the body reference matches the flag. Before attachment, confirm that `captures/` has no tracked files, the entry is a regular file, and neither it nor any parent directory up to the repository root is a symlink. Canonicalize the entry and `captures/` with `realpath -e --`; require the canonical entry to be contained within the canonical `captures/` directory on a whole path-component boundary. Any path that fails these checks is unsafe: stop and report the unsafe reference without adding it to a manual-upload handoff. Enforce the one-reference-per-asset invariant and the 50-file maximum across the complete inventory. A later attachment invocation rewrites only paths included in that invocation, so a partial list leaves older local references in the submitted body. Unreferenced attachments are appended by `gh`; duplicate references produce duplicate embeds. The Markdown alt text survives the hosted-URL rewrite.
4. For every inventory entry, check its MIME type and size before upload. Use GitHub-supported image/video types only (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `video/mp4`, `video/quicktime`, or `video/webm`), and reject a file larger than the conservative 10 MiB inline limit:
   ```bash
   mime="$(file --brief --mime-type "$asset")"
   bytes="$(wc -c < "$asset")"
   case "$mime" in image/png|image/jpeg|image/gif|image/webp|image/svg+xml|video/mp4|video/quicktime|video/webm) ;; *) exit 1;; esac
   test "$bytes" -le 10485760
   ```
   Re-encode or shrink an oversized or unsupported asset using `visual-capture` guidance. If an asset changes, update its reference only in the managed section, then repeat steps 3–4 before attaching. If its reference is outside that section, or it cannot be made uploadable, stop and report it; never submit an asset expected to fail.
5. From the repository root, pass every inventory entry exactly once with `--attach`, using the unchanged literal path from the body and no more than 50 entries.

**Attach and verify.** Run exactly one attachment-bearing edit, with one repeatable `--attach` flag for every local path in the final-body inventory:

Always re-read the body after the command returns, including after a nonzero exit. Capture the status without changing the caller's shell options:

```bash
# Run from the repository root. Each --attach value exactly matches its body reference.
if gh pr edit <number> --body-file "$BODY_FILE" \
  --attach "captures/<run>/widget.png" \
  --attach "captures/<run>/tour.mp4"
then
  attach_status=0
else
  attach_status=$?
fi
gh pr view <number> --json body -q .body
```

Inventory the hosted attachment URLs and every local image/video path still present in the re-read body. A zero exit requires every inventoried local path to have been rewritten to a hosted URL with none remaining. A nonzero exit can mean successful files already updated the PR while other local paths remain. Report the exit status and that exact partial state, then stop; never blindly retry the attachment command because it can duplicate successful uploads. An anonymous 404/403 for an attachment URL on a private repository is expected because the URL inherits repository visibility.

## Composition

- Triggered standalone (`/pr screenshots`) or as a step of `/pr description`, which calls this skill before finalizing the body so UI PRs carry current evidence.
- Within the `pr` workflow, run before the description sync so the refreshed evidence is wired into the final body.
- Delegates all capture to `visual-capture`; pairs with `/git worktree` for the before state.

## Safety Rules

- Never commit captured screenshots or videos to the repo (including the repo root); attach them to the PR instead.
- Never add image/video files to the branch changeset to satisfy this skill.
- Never recapture when existing evidence already reflects the current UI.
- Never capture a blank or error page; if the site is unreachable, stop as blocked.
- Never vary viewport/theme/device between before and after (enforced by `visual-capture`).
- Never bypass `visual-capture`/`playwright-cli` with ad-hoc Puppeteer, `@playwright/test`, or MCP.
- Never commit artifacts or force-push a throwaway image commit to host attachments; use native `gh pr edit --attach` or the pending handoff, never branch history.
- Never pass `--attach` for a path other than a literal relative `captures/...` body reference, a tracked file, a symlink or symlinked parent, an asset that the generated body does not reference exactly once, or more than 50 attachment files.
- Never include an unsafe body path in the manual-upload handoff.
- Never run the attachment edit when any native preflight gate fails.
- Never blindly retry an attachment command after a nonzero exit; re-read the body and report any partial upload state first.
- Never overwrite unrelated PR body content while inserting screenshot references.
- If unexpected working tree changes appear while you are working, stop as blocked and report the unexpected changes.

## Output Style

Report applicability verdict, existing-evidence inventory and classification (missing/stale/current), medium chosen and surfaces captured, before/after mapping, command exit status, hosted attachment URLs and any remaining local paths after an attempted attach, whether artifacts reached the PR through the native attach edit or remain pending handoff with the paste-ready block, confirmation none were committed, and the PR body sections updated.
