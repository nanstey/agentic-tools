# Proposal: Native GitHub CLI Media Attachments

## Purpose

- **Goal**: PR screenshot/clip publishing uses GitHub CLI v2.99.0+ native repeatable `--attach` on one `gh pr edit` command intended to update the body, with no third-party extension, browser cookie, or drag-drop dependency.
- **Current reality**: `pr-screenshots` prefers the third-party `gh-image` extension (full-account `user_session` cookie), falls back to user drag-drop or a paste-ready handoff, edits the body in a separate step, and asserts "GitHub has no public REST/`gh` endpoint for body attachments" — a claim v2.99.0 obsoleted. `visual-capture` tells the user to drag-drop the `.mp4` via the GitHub UI.
- **Options weighed**:
  1. Keep `gh-image` as preferred and add `--attach` as a fallback — rejected; keeps the cookie-based third-party dependency alive with no benefit.
  2. Broaden the change to issue/comment skills — rejected; no repository-owned issue/comment screenshot flow exists, so there is nothing to cut over.
  3. Upload via `--attach` on a no-op comment, then reference URLs in the body — rejected; two mutations, leaves a stray comment.
- **Chosen path**: clean cutover. `pr-screenshots` owns one `gh pr edit <number> --body-file <temp> --attach <path>...` command; `visual-capture` supplies off-tree capture paths and paste-ready local Markdown; `gh-image`, cookie, drag-drop, fabricated-URL, and "no native endpoint" guidance is removed where the native flow supersedes it.

## User story & scenarios

As an agent refreshing a UI PR's visual evidence, I attach captured screenshots and clips to the PR body with one authenticated `gh` command, so publishing needs no third-party extension, session cookie, manual drag-drop, or second body mutation.

Scenarios:

1. **Fresh evidence** — UI changed, no current evidence; capture, then attach and wire into the body in one edit.
2. **Alt text preserved** — captures referenced in local Markdown with alt text keep that alt text after upload rewrites the paths.
3. **Old gh** — installed `gh` predates v2.99.0; preflight blocks the native flow instead of failing mid-edit.
4. **GHES** — target is GitHub Enterprise Server; native attachments are unsupported, so the flow degrades to handoff.
5. **Existing body preserved** — the attach edit adds/refreshes the evidence section without clobbering unrelated body content.

## Behaviour

**Given** a PR with missing/stale visual evidence, no more than 50 captures under the gitignored `captures/` dir, `gh` >= 2.99.0 authenticated with push access to a github.com repo
**When** `pr-screenshots` writes the full intended body (existing content plus a Markdown evidence section referencing each local capture path exactly once, with alt text) to a temp file and runs one `gh pr edit <number> --body-file <temp> --attach <path>` (one `--attach` per asset)
**Then** a zero exit means a re-read of the PR body must show each local path rewritten to a hosted attachment URL with its Markdown alt text preserved and no local paths remaining.

**Given** an attachment attempt returns nonzero
**When** some files upload and others fail
**Then** `pr-screenshots` still re-reads the PR body, inventories hosted URLs and remaining local paths, reports the exact partial state, and does not blindly retry because successful uploads can be duplicated.

**Given** `gh --version` reports < 2.99.0
**When** preflight runs
**Then** the native flow is gated: stop and ask to upgrade `gh`; never attempt `--attach`.

**Given** a GitHub Enterprise Server remote, or a caller without push access
**When** preflight runs
**Then** native attachment is unavailable; fall back to the handoff path (emit artifact paths plus a paste-ready evidence block, mark attach pending).

**Given** an asset over GitHub's per-file limit (~10 MB free-plan video) or an unsupported media type
**When** the size/type check runs before the edit
**Then** re-encode/shrink (per `visual-capture` guidance) or stop and report; never submit an asset expected to fail upload.

**Given** the PR body already contains hosted `user-attachments` URLs that are still current
**When** classification runs
**Then** no recapture and no re-attach occur (unchanged behaviour, restated because duplicate attachment is now a real hazard).

## QA

Deterministic static validation (planning repo has no test suite for skill prose; validation is search-based):

1. Frontmatter/catalog integrity: both changed `SKILL.md` files keep valid frontmatter (`name`, `description`, flags) matching the repository's existing skill layout.
2. Obsolete-guidance sweep: `grep` over `skills/pull-requests/pr-screenshots/SKILL.md` and `skills/visual/visual-capture/SKILL.md` for `gh-image`, `user_session`, `GH_SESSION_TOKEN`, `drag-drop`/`drag and drop`, and `no native`/`no public REST` phrasing returns zero hits in superseded contexts (drag-drop may remain only if explicitly framed as the GHES/old-gh fallback).
3. Consistency sweep: the new flow appears exactly once as the owning recipe in `pr-screenshots`; `visual-capture` hands off paths/Markdown and does not duplicate the `gh pr edit` recipe; `pr-description` still delegates to `pr-screenshots`.

Non-consequential CLI smoke (no live mutation):

4. The workstation's system `gh` reports 2.45.0, proving the documented `< 2.99.0` gate selects the pending-handoff path.
5. An ephemeral official `gh` v2.99.0 binary reports 2.99.0 and its `gh pr edit --help` documents repeatable `--attach`, its 50-file maximum, and that a nonzero exit may follow a partial PR update; the workstation installation remains unchanged.

Runtime evidence: a real upload MUST use a relevant delivery PR only (e.g. the PR shipping this change, if a harmless relevant capture exists). Never upload test media to an unrelated live PR; if no suitable PR exists, record the limitation and rely on checks 4–5.

## Architecture

- **Ownership**: `pr-screenshots` remains the single publishing owner; `visual-capture` remains capture-only, producing off-tree artifacts under `captures/` plus paste-ready local Markdown (paths + alt text). This preserves the existing delegation boundary — only the publish mechanism changes.
- **One-command body edit** (rejected default was upload-then-edit as two steps): build the complete intended body in a temp file referencing local capture paths, then run one `gh pr edit <number> --body-file <temp> --attach <file>` per asset. `gh` can upload successful files and update the PR even when another attachment fails, so this is not atomic. Re-read the body after every attempt, including a nonzero exit, report hosted URLs and remaining local paths, and do not blindly retry.
- **Duplicate prevention**: the body generator references each attached asset exactly once; assets absent from the Markdown would be appended by `gh`, so the reference-once invariant is the contract between body generation and the `--attach` list.
- **Preflight gates** (replacing the `gh-image` preflight): `gh` >= 2.99.0; `gh auth status` OK; push access to the repo; host is github.com (GHES unsupported); and no more than 50 attachment files. Any failure → handoff path (paths + paste-ready block, attach pending); drag-drop survives only as the described manual step within that fallback.
- **Verification**: re-read the PR body (`gh pr view --json body`) after every attach attempt, including a nonzero exit. Confirm hosted URLs replaced every local path after a zero exit; otherwise inventory hosted URLs and remaining local paths as partial state. On private repos an anonymous 404/403 on the attachment URL remains expected, not a failure.
- **Kept as-is**: `pr-description`'s generic REST PATCH fallback (text-only `gh pr edit` failures, e.g. deprecated `projectCards`) stays for text edits but is documented as unable to carry attachments; `pr-create` composition unchanged — the PR exists before `pr-screenshots` runs, so `gh pr edit --attach` fits without touching creation.
- **Out of scope**: issue and PR-comment skills (no existing screenshot flow), browser upload helpers, any new comment-based upload path.

## Affected areas

- `skills/pull-requests/pr-screenshots/SKILL.md` — replace Attachment Paths ranking, the `gh-image Upload Recipe`, related stop-and-ask gates, Safety Rules (`gh-image` install/cookie rules, "no native endpoint" claim), and Output Style wording with the native `--attach` recipe, its preflight gates, duplicate-prevention rule, size/type constraint, and re-read verification. Keep evidence model, applicability, capture delegation, and "never commit artifacts" rules.
- `skills/visual/visual-capture/SKILL.md` — PR Integration section: replace "Attach the `.mp4` via the GitHub UI (drag-drop…)" with a handoff to `pr-screenshots`' native `--attach` publish; keep off-tree `captures/` layout, ~10 MB sizing guidance, and paste-ready Markdown emission (now the input to the attach step).
- `skills/pull-requests/pr-description/SKILL.md` — wording only, if needed: clarify that `pr-screenshots` performs the attachment-bearing body edit and that the REST PATCH fallback is text-only. No workflow change.
- Unchanged: `pr-create`, issue skills, PR-comment skills, browser upload helpers.

## Implementation phases

### Phase 1 — Use native gh media attachments

Deliverable: the three skill files updated per Affected areas — `pr-screenshots` owning the single `gh pr edit --body-file <temp> --attach <file>...` operation with gh >= 2.99.0 / auth / push-access / github.com preflight, reference-once duplicate prevention, size/type constraints, handoff fallback, and re-read verification; `visual-capture` handing off paths/local Markdown instead of prescribing drag-drop; `pr-description` wording aligned. All `gh-image`, `user_session`, fabricated-URL, and "no native endpoint" guidance removed.

V&V gate: QA checks 1–5 pass (frontmatter intact; obsolete-guidance and consistency sweeps clean; local `gh` >= 2.99.0 and `gh pr edit --help` shows repeatable `--attach`). Real-upload evidence only via a relevant delivery PR when one exists; otherwise record the limitation.
