# Use Native gh Media Attachments

## Objective

Cut PR screenshot/clip publishing over to GitHub CLI v2.99.0+ native repeatable `--attach` on a single `gh pr edit --body-file` operation, owned by `pr-screenshots`, with `visual-capture` handing off capture paths and `pr-description` wording aligned — removing all `gh-image`, session-cookie, drag-drop-preferred, and "no native endpoint" guidance.

## Implementation

Ordered; each item is implementation-owned and verifiable by reading the named file.

### `skills/pull-requests/pr-screenshots/SKILL.md`

- [x] Replace Workflow step 7's `gh-image` publish instruction with the native flow: build the complete intended body (existing content plus a Markdown evidence section referencing each local capture path exactly once, with alt text) in a temporary file, then run one `gh pr edit <number> --body-file <temp> --attach <path>` with one repeatable `--attach` per asset and no more than 50 attachments. Remove the "GitHub has no public REST/`gh` endpoint for body attachments" claim from this step.
- [x] Replace the `gh-image` preflight with native preflight gates, each with its check command and failure outcome: `gh --version` >= 2.99.0; `gh auth status` OK; caller has push access to the repo (e.g. `gh repo view --json viewerPermission`); remote host is github.com (GHES unsupported); and no more than 50 attachment files. Any failed gate → handoff path, never a partial `--attach` attempt.
- [x] Replace the **Attachment Paths** ranking in Artifact Handling: (1) native `gh pr edit --attach` (preferred, programmatic); (2) handoff when preflight fails — emit artifact paths plus a paste-ready `## Screenshots` block, mark attach pending, and describe user drag-drop only as the manual step inside that fallback. Remove `gh-image` and the standalone drag-drop tier.
- [x] Replace the **gh-image Upload Recipe** section with a **Native Attach Recipe** documenting: temp body file created via `mktemp` (or equivalent) outside the repo tree and removed after the edit (never a tracked path, so the branch diff cannot gain it); read the existing body first (`gh pr view <number> --json body`) and preserve all unrelated content while inserting/refreshing only the evidence section; the one-reference-per-asset invariant — every `--attach` path appears exactly once in the body Markdown, since unreferenced attachments are appended by `gh` and duplicate references duplicate embeds; the 50-file maximum; alt-text handling — Markdown alt text on the local reference survives the URL rewrite.
- [x] Add a pre-edit size/type check to the recipe: each asset is a GitHub-supported image/video type and within the per-file limit (~10 MB free-plan video); oversized/unsupported assets are re-encoded or shrunk per `visual-capture` guidance, or the flow stops and reports — never submit an asset expected to fail upload.
- [x] Add post-edit verification to the recipe: after every attach attempt, including a nonzero exit, re-read the body (`gh pr view <number> --json body`). A zero exit must leave hosted attachment URLs in place of every local capture path with none remaining. A nonzero exit may have partially updated the PR; inventory hosted URLs and remaining local paths, report that exact state, and never blindly retry because it can duplicate successful uploads. Note that anonymous 404/403 on private-repo attachment URLs is expected, not a failure.
- [x] Update Workflow step 8 and the stop-and-ask gates: verification is the hosted-URL re-read above; gates become old `gh` (< 2.99.0), missing auth/push access, GHES host, more than 50 attachment files, site unreachable, ambiguous before/after refs, capture tooling unavailable, or an artifact landing in the repo. Remove the `gh-image` extension-missing gate.
- [x] Rewrite Safety Rules: delete the `gh-image` install/vetting rule, the `user_session`/`GH_SESSION_TOKEN` secrecy rule, and the "never claim a native endpoint exists" rule; keep never-fabricate-URLs, never-commit-artifacts, never-overwrite-unrelated-body-content; add never pass `--attach` for an asset the generated body does not reference, never pass more than 50 attachment files, never run the attach edit when any preflight gate fails, and never blindly retry after a nonzero exit before reporting the re-read partial state.
- [x] Update Required Inputs item 4 and Output Style to name the native attach edit (or pending handoff) as how artifacts reached the PR; remove drag-drop as a reported publish path outside the fallback.
- [x] Confirm frontmatter (`name`, `description`, `user-invocable`, `disable-model-invocation`) and the untouched sections (Evidence Model, Applicability, capture delegation, Composition, never-commit rules) remain intact.

### `skills/visual/visual-capture/SKILL.md`

- [x] Rewrite the **PR Integration** bullet "Attach the `.mp4` via the GitHub UI (drag-drop…)": publishing is a handoff to `pr-screenshots`, which attaches assets natively via `gh pr edit --attach`; this skill's outputs are the off-tree paths under `$CAP` plus the paste-ready local Markdown (paths + alt text) that feed that step. Do not duplicate the `gh pr edit` recipe here. Keep the `.webm`-embedding caveat, the tracked-asset-dir exception, and the ~10 MB per-file sizing guidance.
- [x] Confirm frontmatter and all capture workflow, recipes, output layout, and gotchas sections are unchanged.

### `skills/pull-requests/pr-description/SKILL.md`

- [x] Wording only, no workflow change: state that `pr-screenshots` performs the attachment-bearing body edit (Workflow step 6 and/or Guidelines), and annotate the Implementation Notes REST PATCH fallback as text-only — it cannot carry media attachments, which belong to `pr-screenshots`' native `--attach` edit.

### Cross-file sweep

- [x] Remove every remaining superseded mention of `gh-image`, `user_session`, `GH_SESSION_TOKEN`, drag-drop-as-preferred-path, fabricated attachment URLs, and no-native-endpoint claims across the three files; drag-drop may survive only inside the explicitly framed preflight-failure fallback in `pr-screenshots`.

## Test Scenarios

QA-owned. Non-consequential CLI checks and static content checks; no live mutation required.

### CLI availability (read-only)

- [x] Given this workstation's system GitHub CLI 2.45.0, when `gh --version` runs and the documented preflight is applied, then the native attach edit is rejected in favor of the pending-handoff path.
- [x] Given an ephemeral official GitHub CLI v2.99.0 binary, when its version and `gh pr edit --help` run, then it reports 2.99.0 and documents an `--attach` file flag repeatable for multiple files without changing the workstation installation.

### Static content

- [x] Given the updated `pr-screenshots` SKILL.md, when it is read end-to-end, then exactly one owning recipe describes the single `gh pr edit <number> --body-file <temp> --attach <path>` operation, and that recipe includes version/auth/push/host/50-file preflight gates, the one-reference-per-asset invariant, the size/type check, private temp-directory creation and cleanup, existing-body preservation, partial-failure handling, and hosted-URL re-read verification.
- [x] Given the three changed files, when a search runs for `gh-image`, `drogers0`, `user_session`, and `GH_SESSION_TOKEN`, then it returns zero hits.
- [x] Given the three changed files, when a search runs for drag-drop / "drag and drop" phrasing, then every remaining hit sits inside `pr-screenshots`' explicitly framed preflight-failure fallback and none describes a preferred or standalone publish path.
- [x] Given the three changed files, when a search runs for "no native", "no public REST", and fabricated-URL phrasing, then no text claims native `gh` body attachments are unavailable (never-fabricate-URLs as a standing safety rule may remain).
- [x] Given the updated `visual-capture` SKILL.md, when its PR Integration section is read, then publishing is a handoff to `pr-screenshots` with paths and paste-ready local Markdown, the `gh pr edit` recipe is not duplicated, and the `captures/` layout and ~10 MB sizing guidance are unchanged.
- [x] Given the updated `pr-description` SKILL.md, when its workflow and Implementation Notes are read, then it still delegates evidence refresh to `pr-screenshots`, its steps are otherwise unchanged, and the REST PATCH fallback is described as text-only.
- [x] Given both changed SKILL.md files, when their frontmatter is checked against the repository's skill layout, then `name`, `description`, `user-invocable`, and `disable-model-invocation` are valid and the names still match their README catalog entries.
- [x] Given the delivery PR body describing this change and its handoff fallback, when the flow's degraded path is exercised on paper (preflight gate fails), then the documented outcome is a paste-ready evidence block plus artifact paths with attach marked pending — no partial `--attach` attempt.

### Optional runtime evidence (conditional, not a gate)

- [x] Given the delivery PR for this change and a harmless, genuinely relevant capture artifact, when one `gh pr edit <number> --body-file <temp> --attach <path>` runs against that PR only, then re-reading the body shows the hosted `user-attachments` URL in place of the local path with alt text preserved. If no relevant harmless artifact exists, skip this scenario and record the limitation; never upload test media to an unrelated live PR, and never treat this scenario as a merge prerequisite. Skipped as designed: no delivery PR or relevant media artifact existed during QA; see [`qa.md`](../qa.md).

## Risk Controls

- Live mutation is confined to the optional delivery-PR scenario above; all other verification is read-only (`--help`, `--version`, file reads/searches).
- The one-reference-per-asset invariant is stated in both the recipe and Safety Rules so body generation and the `--attach` list cannot drift apart (unreferenced attachments get appended; duplicates get embedded twice).
- Preflight gates fail closed to the handoff path — an old `gh`, missing push access, or a GHES host never reaches a partial edit.
- The temp body file lives outside the repo tree and is removed after the edit, so the branch diff cannot gain body or media files.
- Existing PR body content is read before the edit and preserved verbatim outside the evidence section.
- `pr-description`'s REST PATCH fallback is retained for text-only failures but explicitly marked unable to carry attachments, preventing a silent downgrade of the media path.

## Out of Scope

- Issue and PR-comment skills (no repository-owned screenshot flow exists to cut over).
- `pr-create` and PR creation composition.
- Browser upload helpers and any comment-based upload path.
- Source code, scripts, `install.sh`, dependencies, and new test infrastructure.
- Formatters, linters, and project-wide test suites.
