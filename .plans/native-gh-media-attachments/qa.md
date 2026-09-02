# QA: Native GitHub CLI Media Attachments

- Result: pass
- Runtime mutation: skipped; no delivery PR existed during QA and this documentation-only change has no relevant capture artifact.

## Scenario evidence

1. **Old-version gate — pass.** System `gh --version` reported 2.45.0. The source gate in `pr-screenshots` routes versions below 2.99.0 to pending handoff and forbids an attach attempt.
2. **Native flag availability — pass.** An official GitHub CLI v2.99.0 binary was downloaded into a private temporary workspace. `gh --version` reported 2.99.0; `gh pr edit --help` documented repeatable `--attach`, local-reference rewriting, a 50-file maximum, and partial-update behavior after a nonzero exit. The workstation installation was unchanged.
3. **Owning recipe — pass.** `skills/pull-requests/pr-screenshots/SKILL.md` contains one canonical attach command. It covers version/auth/push/host/50-file gates, exact body-file preservation, supported MIME/size checks, one-reference-per-asset, private temp cleanup, existing-body preservation, and mandatory post-attempt re-read.
4. **Obsolete third-party path — pass.** No `gh-image`, `drogers0`, `user_session`, or `GH_SESSION_TOKEN` match remains in the three changed skills.
5. **Fallback wording — pass.** The only drag-and-drop match is the explicitly framed manual action after native preflight fails.
6. **Obsolete endpoint claims — pass.** No claim says native GitHub CLI attachments are unavailable. The surviving “Do not fabricate attachment URLs” rule is a safety invariant.
7. **Capture integration — pass.** `visual-capture` hands off off-tree paths and local Markdown to `pr-screenshots`; it does not duplicate the attach command. Capture layout, MP4 guidance, and size limits remain.
8. **Description integration — pass.** `pr-description` still delegates refresh to `pr-screenshots`, preserves its attachments, and labels REST PATCH as text-only.
9. **Frontmatter/catalog — pass.** `pr-screenshots` and `visual-capture` retain required frontmatter, names match their directories, and both remain cataloged in `README.md`.
10. **Degraded path — pass.** Every native preflight failure emits artifact paths plus paste-ready Markdown, marks attachment pending, and runs no partial attach command.
11. **Conditional live upload — skipped as designed.** `gh pr view --json url` found no PR for `docs/native-gh-media-attachments`; no relevant harmless media artifact exists for this non-UI change. No unrelated PR was mutated.

## Additional checks

- `jq -j '.body'` preserved exact byte sequences for bodies ending with zero, one, and two newlines, plus an empty body.
- `git diff --check` passed.
- Official supported media MIME guidance includes PNG, JPEG, GIF, WebP, SVG, MP4, MOV, and WebM.
