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
4. Artifact publish outcome: a completed native `gh pr edit --body-file <temp> --attach <path>` edit, or a pending handoff with validated literal off-tree capture paths and paste-ready local Markdown.

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

- Do **not** add screenshots or videos to the repository. They live only below the exact private `$CAP` that `visual-capture` emits for the current repository and branch, and reach the PR as GitHub attachments hosted off-tree.
- Attachment paths, best first:
  1. **Native `gh pr edit --attach`** (preferred, programmatic). It uploads each validated literal off-tree capture while rewriting the PR body in one operation. See **Native Attach Recipe**.
  2. **Handoff when a non-safety preflight fails.** Emit validated artifact paths plus a paste-ready `## Screenshots` block containing each validated local path and its alt text. Mark the attach as pending. The user may manually drag and drop those files into the PR body as the fallback step; do not run any `--attach` flags. An unsafe path stops without a handoff.
- There is no tracked-asset exception. Reference attachments in the PR body only; the branch diff must not gain image/video files.

## Native Attach Recipe

Use one native attachment-bearing body edit. It uploads the assets and rewrites their local Markdown references to hosted URLs without adding body or media files to the branch.

**Preflight.** Run every gate before generating an attachment edit. Any non-safety failure takes the pending-handoff path in **Artifact Handling**; an unsafe path stops without a handoff. Never submit a partial `--attach` attempt.

| Gate | Check | Failure outcome |
| --- | --- | --- |
| GitHub CLI version | `gh --version` reports version 2.99.0 or later | Emit paths and paste-ready Markdown; mark attach pending. |
| GitHub authentication | `gh auth status` exits successfully | Emit paths and paste-ready Markdown; mark attach pending. |
| Push access | `gh repo view --json viewerPermission -q .viewerPermission` reports `ADMIN`, `MAINTAIN`, or `WRITE` | Emit paths and paste-ready Markdown; mark attach pending. |
| Public GitHub host | `gh repo view --json url -q .url` resolves to `https://github.com/...` | Emit paths and paste-ready Markdown; mark attach pending. GHES is unsupported. |
| Attachment inventory and count | After body preparation, the final body has an inventory of every local image/video path. Each entry is a literal absolute path below the exact current-repository-and-branch `$CAP` emitted by `visual-capture` from this repository cwd, has only attachment-safe path characters, has no `.` or `..` component, is a regular non-symlink file, has no symlinked parent, is outside the canonical repository root, and is not tracked by Git. Revalidate `$CAP` and its private ownership/mode immediately before attaching. Pass each entry exactly once with `--attach`, with at most 50 entries. | For an unsafe path, stop and report it without including it in a handoff. Otherwise emit only validated paths and paste-ready Markdown; mark attach pending. |

**Prepare the body and assets.**

1. Create a private temporary workspace, register recursive cleanup immediately, and serialize the existing body directly to a file. `jq -j` writes the JSON string without adding or removing a final newline:
   ```bash
   TMP_DIR="$(mktemp -d)"
   trap 'rm -rf "$TMP_DIR"' EXIT
   BODY_FILE="$TMP_DIR/body.md"
   gh pr view <number> --json body | jq -j '.body' > "$BODY_FILE"
   ```
2. Use a structured body-file editor to insert or refresh only the managed `## Screenshots` evidence section in `"$BODY_FILE"`. It must preserve every byte outside that section's exact byte range; when the section is absent, it must insert the new section without rewriting existing body bytes. Build the section from the local capture paths, with descriptive Markdown alt text. Do not read the body into a shell variable or rewrite it with shell substitution.
3. Inspect the complete final `"$BODY_FILE"`, not only the refreshed `## Screenshots` section or newly captured files. Inventory every local image/video path it references, while preserving already-hosted URLs. Do not expand `~`, environment variables, globs, URLs, or relative paths. Run `gh pr edit` from the repository root and retain the exact literal body string for its `--attach` flag, so the body reference matches the flag.

   Establish the exact allowed directory by invoking the helper from the target repository cwd, using the absolute path to the installed skill. Do not invoke it from the skill directory or reconstruct its root yourself:
   ```bash
   canonical_dir() ( cd -P -- "$1" && pwd -P )
   is_within() {
     [ "$1" = "$2" ] && return 0
     [ "$2" = "/" ] && return 0
     case "$1" in "$2"/*) return 0 ;; esac
     return 1
   }
   private_dir() {
     python3 -I -c '
import os, stat, sys
st = os.lstat(sys.argv[1])
if not stat.S_ISDIR(st.st_mode) or st.st_uid != os.geteuid() or stat.S_IMODE(st.st_mode) != 0o700:
    raise SystemExit(1)
' "$1"
   }
   repo_root="$(canonical_dir "$(git rev-parse --show-toplevel)")" || exit 1
   VISUAL_CAPTURE_SKILL_DIR="/absolute/path/to/installed/visual-capture"
   CAP="$(cd "$repo_root" && bash "$VISUAL_CAPTURE_SKILL_DIR/scripts/capture-dir.sh")" || exit 1
   capture_root="$(dirname "$(dirname "$CAP")")"
   repo_capture_dir="$(dirname "$CAP")"
   private_dir "$capture_root" && private_dir "$repo_capture_dir" && private_dir "$CAP" || exit 1
   is_within "$CAP" "$repo_root" && exit 1
   ```
   For every literal `$asset`, require the raw string to begin with `"$CAP"/` on a path-component boundary, with no empty, `.` or `..` component. To preserve literal Markdown-to-`--attach` matching and avoid gh's `#` separator, reject every path containing a character outside `[A-Za-z0-9_./-]`, including whitespace, `#`, quotes, brackets, parentheses, backticks, or backslashes. Require `[ -f "$asset" ] && [ ! -L "$asset" ]`. Walk its literal parent paths back to, but not above, `$CAP` and reject any symlink. Set `canonical_asset="$(python3 -I -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$asset")"`; require the canonical file to be below the canonical `$CAP` on a whole path-component boundary and outside the canonical `$repo_root` on that boundary. Reject it if `git -C "$repo_root" ls-files --error-unmatch -- "$canonical_asset"` succeeds. Any path that fails these checks is unsafe: stop and report the unsafe reference without adding it to a manual-upload handoff. Enforce the one-reference-per-asset invariant and the 50-file maximum across the complete inventory. A later attachment invocation rewrites only paths included in that invocation, so a partial list leaves older local references in the submitted body. Unreferenced attachments are appended by `gh`; duplicate references produce duplicate embeds. The Markdown alt text survives the hosted-URL rewrite.
4. For every inventory entry, check its MIME type and size before upload. Use GitHub-supported image/video types only (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/svg+xml`, `video/mp4`, `video/quicktime`, or `video/webm`), and reject a file larger than the conservative 10 MiB inline limit:
   ```bash
   mime="$(file --brief --mime-type "$asset")"
   bytes="$(wc -c < "$asset")"
   case "$mime" in image/png|image/jpeg|image/gif|image/webp|image/svg+xml|video/mp4|video/quicktime|video/webm) ;; *) exit 1;; esac
   test "$bytes" -le 10485760
   ```
   Re-encode or shrink an oversized or unsupported asset using `visual-capture` guidance. If an asset changes, update its reference only in the managed section, then repeat steps 3–4 before attaching. If its reference is outside that section, or it cannot be made uploadable, stop and report it; never submit an asset expected to fail.
5. Immediately before the one attachment command, run `CURRENT_CAP="$(cd "$repo_root" && bash "$VISUAL_CAPTURE_SKILL_DIR/scripts/capture-dir.sh")"` and require `[ "$CURRENT_CAP" = "$CAP" ]`. Re-run `private_dir` for `$capture_root`, `$repo_capture_dir`, and `$CAP`, then repeat the full literal-path, parent-symlink, canonical-path, Git-tracking, MIME, size, uniqueness, and count checks from steps 3–4 against that exact `$CAP`. Do not change the body or artifact paths after this revalidation. From the repository root, pass every inventory entry exactly once with `--attach`, using the unchanged validated literal off-tree path from the body and no more than 50 entries.

**Attach and verify.** Run exactly one attachment-bearing edit, with one repeatable `--attach` flag for every local path in the final-body inventory:

Always re-read the body after the command returns, including after a nonzero exit. Capture the status without changing the caller's shell options:

```bash
# Run from the repository root. Each --attach value exactly matches its body reference.
if gh pr edit <number> --body-file "$BODY_FILE" \
  --attach "$CAP/widget.png" \
  --attach "$CAP/tour.mp4"
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
- Never pass `--attach` for a body path that is not an unchanged literal absolute path below the exact `$CAP` emitted for the current repository and branch, contains characters outside `[A-Za-z0-9_./-]`, contains an empty, `.` or `..` component, resolves inside the canonical repository root, is tracked by Git, is not a regular non-symlink file, has a symlinked parent, is not referenced exactly once by the generated body, exceeds 50 attachment files, or has not had its `$CAP` ownership/private-directory checks revalidated immediately before attaching.
- Never include an unsafe body path in the manual-upload handoff.
- Never run the attachment edit when any native preflight gate fails.
- Never blindly retry an attachment command after a nonzero exit; re-read the body and report any partial upload state first.
- Never overwrite unrelated PR body content while inserting screenshot references.
- If unexpected working tree changes appear while you are working, stop as blocked and report the unexpected changes.

## Output Style

Report applicability verdict, existing-evidence inventory and classification (missing/stale/current), medium chosen and surfaces captured, before/after mapping, command exit status, hosted attachment URLs and any remaining local paths after an attempted attach, whether artifacts reached the PR through the native attach edit or remain pending handoff with the paste-ready block, confirmation none were committed, and the PR body sections updated.
