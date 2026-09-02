# Discovery: Native GitHub CLI Media Attachments

## Goal and acceptance criteria

Replace repository-authored screenshot and clip publishing workarounds with GitHub CLI v2.99.0+ native, repeatable `--attach` flags. Preserve off-tree capture storage, alt text, existing PR body content, capture delegation, and post-write verification. Remove `gh-image`, browser-cookie, drag-drop, fabricated-URL, and REST body-update fallback guidance where native attachment handling supersedes it.

## Verified external behaviour

- GitHub CLI v2.99.0 introduced repeatable `--attach` for `gh issue create|edit|comment` and `gh pr create|edit|comment`.
- `--attach` uploads supported image/video files. A matching local Markdown path is rewritten in place; otherwise the attachment is appended.
- Alt text can follow a path after `#`; Markdown alt text wins when a local reference is rewritten.
- Push access is required. GitHub Enterprise Server is unsupported in this release.
- Source: https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli

## Current repository behaviour

- `skills/pull-requests/pr-screenshots/SKILL.md:12-15,43-58` owns capture applicability, delegates capture, publishes assets, and edits the PR body.
- `skills/pull-requests/pr-screenshots/SKILL.md:60-98` prefers the third-party `gh-image` extension, requires a browser `user_session` cookie, falls back to drag-drop/handoff, then separately edits the PR body.
- `skills/pull-requests/pr-screenshots/SKILL.md:106-123` encodes obsolete safety/output claims that native `gh` attachment endpoints do not exist.
- `skills/visual/visual-capture/SKILL.md:66-80,149-179` produces off-tree screenshots and MP4 clips plus paste-ready Markdown; publishing guidance still requires UI drag-drop.
- `skills/pull-requests/pr-description/SKILL.md:20-35,88-105` invokes `pr-screenshots`, preserves attachments, and separately writes/verifies PR body content. Its generic REST fallback remains useful for text-only failures but cannot replace native media upload.
- `skills/pull-requests/pr-create/SKILL.md` creates a PR before invoking description/screenshot refresh; native `gh pr edit --attach` therefore fits the current composition without redesigning PR creation.
- Issue skills and generic PR comment skills have no repository-owned screenshot upload flow. Browser upload helpers capture/input files but do not publish GitHub PR evidence.

## Decision

One PR-sized slice. Update `pr-screenshots` as the publishing owner and `visual-capture` as its artifact handoff. Keep `pr-description` composition unchanged unless wording must clarify that `pr-screenshots` performs the native attachment edit. Do not broaden issue/comment skills without an existing screenshot workflow.

Use a temporary body file that references local capture paths, then execute one `gh pr edit <number> --body-file <file> --attach <path>...` command. This lets `gh` upload and rewrite in one operation, preserves Markdown alt text, avoids shell quoting hazards, and prevents a second body mutation. Re-read the PR body to verify hosted attachment URLs replaced local paths.

## Validation and runtime verification

- Validate skill frontmatter/catalog integrity using the repository's existing deterministic gate discovered during preflight.
- Search changed skills for obsolete `gh-image`, `user_session`, drag-drop, and “no native endpoint” guidance.
- Exercise command availability with installed `gh`: confirm v2.99.0+ and `gh pr edit --help` documents repeatable `--attach`.
- Avoid uploading test media to an unrelated live PR. Runtime evidence may use the delivery PR itself only if a harmless capture exists and the attachment is relevant; otherwise record the access limitation and verify CLI semantics locally.

## Risks

- Older `gh` versions cannot execute the new flow; preflight must gate at v2.99.0.
- GHES remains unsupported for native media uploads.
- Authentication alone is insufficient; the caller needs repository push access.
- Passing an attachment absent from the Markdown appends it, so generated body content must reference every intended asset exactly once.
- Video/image plan limits and supported formats remain GitHub constraints.
