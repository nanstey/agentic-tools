# Use Native gh Media Attachments

## Objective

Cut PR screenshot/clip publishing over to GitHub CLI v2.99.0+ native repeatable `--attach` on a single `gh pr edit --body-file` operation, owned by `/pr screenshots`, with `visual-capture` handing off capture paths and `/pr description` wording aligned.

## Implementation

Ordered; each item is implementation-owned and verifiable by reading the named file.

### `skills/pull-requests/pr/SKILL.md`

- [x] The `--screenshots` workflow owns the native attachment flow, preflight gates, body preservation, one-reference-per-asset rule, 50-file maximum, size/type checks, handoff fallback, and post-attempt re-read.
- [x] The `--description` workflow preserves attachment-bearing content and documents its text-only REST fallback.

### `skills/visual/visual-capture/SKILL.md`

- [x] The PR Integration section hands publishing to `/pr screenshots`, which attaches assets natively via `gh pr edit --attach`; this skill emits the off-tree paths and paste-ready local Markdown that feed that step. Do not duplicate the recipe. Keep the `.webm` caveat, tracked-asset-dir exception, and size guidance.
- [x] Confirm frontmatter and all capture workflow, recipes, output layout, and gotchas sections are unchanged.

### Cross-file sweep

- [x] Removed obsolete separate PR skill references. The unified command owns its action workflows, and drag-drop remains only as a preflight-failure fallback in `--screenshots`.

## Test Scenarios

QA-owned. Non-consequential CLI checks and static content checks; no live mutation required.

### CLI availability (read-only)

- [x] Given this workstation's system GitHub CLI 2.45.0, when `gh --version` runs and the documented preflight is applied, then the native attach edit is rejected in favor of the pending-handoff path.
- [x] Given an ephemeral official GitHub CLI v2.99.0 binary, when its version and `gh pr edit --help` run, then it reports 2.99.0 and documents an `--attach` file flag repeatable for multiple files without changing the workstation installation.

### Static content

- [x] Given the unified PR skill, then its `--screenshots` workflow contains exactly one owning native attachment recipe with version/auth/push/host/50-file preflight, reference-once, size/type, private-temp, preservation, partial-failure, and re-read guidance.
- [x] The consolidated workflow removes superseded third-party upload guidance.
- [x] Drag-drop appears only as an explicitly framed `--screenshots` preflight-failure fallback.
- [x] No text claims native `gh` body attachments are unavailable.
- [x] `visual-capture` hands paths and paste-ready local Markdown to `/pr screenshots` without duplicating the recipe.
- [x] `/pr description` refreshes evidence through the unified screenshots workflow and retains a text-only REST fallback.
- [x] The relevant frontmatter and README catalog entries remain valid.
- [x] Given the delivery PR body describing this change and its handoff fallback, when the flow's degraded path is exercised on paper (preflight gate fails), then the documented outcome is a paste-ready evidence block plus artifact paths with attach marked pending — no partial `--attach` attempt.

### Optional runtime evidence (conditional, not a gate)

- [x] Given the delivery PR for this change and a harmless, genuinely relevant capture artifact, when one `gh pr edit <number> --body-file <temp> --attach <path>` runs against that PR only, then re-reading the body shows the hosted `user-attachments` URL in place of the local path with alt text preserved. If no relevant harmless artifact exists, skip this scenario and record the limitation; never upload test media to an unrelated live PR, and never treat this scenario as a merge prerequisite. Skipped as designed: no delivery PR or relevant media artifact existed during QA; see [`qa.md`](../qa.md).

## Risk Controls

- Live mutation is confined to the optional delivery-PR scenario above; all other verification is read-only (`--help`, `--version`, file reads/searches).
- The one-reference-per-asset invariant is stated in both the recipe and Safety Rules so body generation and the `--attach` list cannot drift apart (unreferenced attachments get appended; duplicates get embedded twice).
- Preflight gates fail closed to the handoff path — an old `gh`, missing push access, or a GHES host never reaches a partial edit.
- The temp body file lives outside the repo tree and is removed after the edit, so the branch diff cannot gain body or media files.
- Existing PR body content is read before the edit and preserved verbatim outside the evidence section.
- `/pr description` retains its text-only REST PATCH fallback, explicitly unable to carry attachments.

## Out of Scope

- Issue and PR-comment skills (no repository-owned screenshot flow exists to cut over).
- PR creation composition.
- Browser upload helpers and any comment-based upload path.
- Source code, scripts, `install.sh`, dependencies, and new test infrastructure.
- Formatters, linters, and project-wide test suites.
