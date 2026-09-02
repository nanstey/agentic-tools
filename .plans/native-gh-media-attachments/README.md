# Native GitHub CLI Media Attachments

- Status: done
- Summary: Replace screenshot attachment workarounds with GitHub CLI v2.99+ native `--attach` flows.

## Design
| Stage | Doc | Status |
| --- | --- | --- |
| Proposal | [proposal](./proposal.md) | done |

## Slices
| # | Slice | Spec | PR | Status |
| --- | --- | --- | --- | --- |
| 1 | Use native gh media attachments | [01-use-native-gh-media-attachments](./specs/01-use-native-gh-media-attachments.md) | [#53](https://github.com/nanstey/agentic-tools/pull/53) | review-ready |

## Decision log
- 2026-09-02 — Autopilot run started; treat GitHub CLI v2.99.0 native `--attach` as the target integration.
- 2026-09-02 — Discovery completed in [discovery.md](./discovery.md): one PR-sized slice updates `pr-screenshots` and `visual-capture`; existing issue/comment flows remain unchanged.
  Proposal assigned from the verified discovery packet; expected artifact: `proposal.md` plus one seeded slice row.
- 2026-09-02 — Proposal written in [proposal.md](./proposal.md): clean cutover to one `gh pr edit --body-file <temp> --attach <file>...` operation owned by `pr-screenshots`; `visual-capture` supplies off-tree paths/local Markdown; handoff remains the sole fallback (old gh / GHES / no push access); no issue/comment scope.
- 2026-09-02 — Slice specification assigned from [proposal.md](./proposal.md); expected artifact: `specs/01-use-native-gh-media-attachments.md` with separate implementation and QA-owned scenario checklists.
- 2026-09-02 — Specification completed. Delivery branch `docs/native-gh-media-attachments` was created from refreshed `origin/HEAD` (`cfc01c5`).
- 2026-09-02 — Preflight: no package manager or project test runner applies; baseline `git diff --check` passed. GitHub access is authenticated to `github.com/nanstey/agentic-tools` with `ADMIN` permission. System `gh` is 2.45.0 and lacks `--attach`; validate native help with an ephemeral official v2.99.0 binary without changing workstation dependencies.
- 2026-09-02 — Execution plan: one implementation owner updates the three specified skills and checks only `## Implementation`; an independent reviewer checks the diff/spec; a separate QA owner checks only `## Test Scenarios`.
- 2026-09-02 — Implementation completed across `pr-screenshots`, `visual-capture`, and `pr-description`; all 14 implementation-owned spec items checked. Independent acceptance review assigned against the proposal and slice spec.
- 2026-09-02 — Independent review blocked QA: command substitution and unconditional newline changed trailing body bytes; the temp recipe also needs a private directory. One narrow implementation retry assigned to preserve the existing body byte-for-byte outside the managed section and use `mktemp -d` cleanup.
- 2026-09-02 — QA plan adjusted after preflight: system `gh` 2.45.0 now proves the old-version handoff gate; native flag semantics use an ephemeral official v2.99.0 binary. No workstation dependency change.
- 2026-09-02 — Review passed after fixes: body bytes are preserved outside the managed section, temp files stay in a private directory, and one canonical attach command handles the 50-file cap and partial nonzero updates without blind retry. QA assigned to execute the 11 scenario dispositions and write `qa.md`.
- 2026-09-02 — QA passed; evidence in [qa.md](./qa.md). All 14 implementation items and 11 scenario dispositions are checked. Live upload was skipped because no delivery PR or relevant UI artifact existed; system-old and ephemeral-native CLI paths were both exercised.
- 2026-09-02 — Commit `3387e67` pushed and draft PR [#53](https://github.com/nanstey/agentic-tools/pull/53) opened against `main`. `gh pr edit` hit the known classic-Projects failure, so the verified text-only REST fallback updated the description; the PR re-read is clean.
- 2026-09-02 — Final independent audit passed: artifacts, 25 checked implementation/QA dispositions, source scope, base/head, PR body, and non-UI screenshot applicability all match. Pipeline closed.
