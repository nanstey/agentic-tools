# QA: Native GitHub CLI Media Attachments

- Result: pass
- Runtime mutation: skipped; no delivery PR existed during QA and this documentation-only change has no relevant capture artifact.

## Scenario evidence

1. **Old-version gate — pass.** The unified `--screenshots` workflow routes versions below 2.99.0 to pending handoff and forbids an attach attempt.
2. **Native flag availability — pass.** The tested GitHub CLI documented repeatable `--attach`, a 50-file maximum, and potential partial PR updates.
3. **Owning recipe — pass.** `skills/pull-requests/pr/SKILL.md` contains the canonical attach command and its preflight, preservation, validation, and re-read rules.
4. **Capture integration — pass.** `visual-capture` hands off off-tree paths and local Markdown to `/pr --screenshots`; it does not duplicate the attach command.
5. **Description integration — pass.** `/pr --description` preserves attachments and labels REST PATCH as text-only.
6. **Frontmatter/catalog — pass.** `pr` and `visual-capture` retain required frontmatter and remain cataloged.
7. **Degraded path — pass.** Every native preflight failure emits artifact paths plus paste-ready Markdown, marks attachment pending, and runs no partial attach command.
11. **Conditional live upload — skipped as designed.** `gh pr view --json url` found no PR for `docs/native-gh-media-attachments`; no relevant harmless media artifact exists for this non-UI change. No unrelated PR was mutated.

## Additional checks

- `jq -j '.body'` preserved exact byte sequences for bodies ending with zero, one, and two newlines, plus an empty body.
- `git diff --check` passed.
- Official supported media MIME guidance includes PNG, JPEG, GIF, WebP, SVG, MP4, MOV, and WebM.
