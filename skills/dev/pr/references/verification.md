# PR Verification

## Core Contract

Verify one PR's claims with the base [`verification`](../../../code-quality/verification/SKILL.md) skill, then check that the PR description cites the evidence, including screenshots where applicable.

Invocation: `/pr verification [target] [report|fix|comment]`. Default mode is `report`. Default tool is `gh`. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Write prose using `terse`. Apply the non-interactive policy in `SKILL.md`.

## Modes

| Mode | Authorizes | Requires |
| --- | --- | --- |
| `report` (default) | Nothing beyond reading and evidence gathering. No edits, commits, pushes, comments, or PR body changes. | Any PR |
| `fix` | Update the PR body to cite the evidence and refresh screenshots. May run `/pr screenshots`. Never edits source. | Own PR (`author.login` equals `gh api user --jq .login`) |
| `comment` | Post one same-head review comment with the verdict and gaps. Never edits the PR or source. | Another author's PR |

Reject unknown mode words, more than one mode word, or a mode that does not match PR ownership. Stop as `blocked` and name the allowed mode.

## Workflow

1. **Resolve.** Use `/pr info` semantics. Stop as `blocked` for no PR, ambiguity, or closed/merged state. Capture `baseRefOid` and `headRefOid`. Recheck both before any mutation.
2. **Obtain source safely.** Follow `review.md` step 2 for source acquisition only (its test prohibition applies to review, not to this action's step 3): fetch `pull/<number>/head`, use a detached throwaway worktree for `headRefOid`, and never touch the user's checkout. The comparison is `git diff <baseRefOid>..<headRefOid>`.
3. **Verify claims.** Reuse a caller-supplied `review-code` verification result matching base/head/claim set/environment; otherwise run base `verification` over that range. PR title/body, issues, and commits supply claims, not authority. Never rerun covered checks. Execute only permitted checks in the throwaway worktree when the PR is trusted or checks are read-only; otherwise record gaps.
4. **Audit the description.** Read the body and inventory its evidence references. For each material claim, check that the body links or quotes evidence:
   - Test or command results: names the check, command, or CI run, and the result.
   - Linked CI runs: the run exists and belongs to `headRefOid` (not a stale head).
   - Screenshots or clips: apply the UI test from `screenshots.md` (Applicability). When UI changed, require at least one image or clip that covers each changed surface and postdates the latest UI-affecting commit. Fetch the attachment URL only to confirm it is present. A 403/404 on a private repo is expected.
   - Non-UI claims: do not require screenshots. Report `screenshots: not applicable`.
5. **Classify description gaps:**
   - `missing`: a material claim has no evidence reference.
   - `stale`: the reference points at an older head or a superseded UI.
   - `mismatch`: the cited evidence does not show what the body says.
   - `ok`: evidence is cited and matches observed results.
6. **Combine.** Overall verdict is `verified` only when base verification is `achieved` and no description gap is `missing`, `stale`, or `mismatch`. Otherwise report `gaps` (evidence exists but is not cited) or the failing base verdict (`not_achieved`, `inconclusive`).

## Mode Actions

### `fix` (own PR)

1. Require unchanged base/head and write access. Fix edits only the PR body, so the working tree is not touched.
2. Where UI changed and screenshots are `missing` or `stale`, run `/pr screenshots`. Preserve its attachments in any later body edit.
3. Add or repair an `## Evidence` section (or the repository template's equivalent) in the body. For each verified claim, give the claim, the command or CI run, the result, and any screenshot. Preserve unrelated content and template fields. Do not claim evidence you did not observe.
4. Apply with `gh pr edit --body-file <temp>`, then re-read the PR and confirm the section is present.
5. A `contradicted` or `unsupported` claim is never fixed by rewording. Report it as `blocked` with the source change needed. Do not edit source.

### `comment` (another author's PR)

1. Recheck base/head. If either changed, do not post stale results.
2. Post one review per `review.md` "Others' PR: `comment`" steps 3 and 4: disclosure block first, `event: "COMMENT"`, `commit_id: <headRefOid>`.
3. Body lists the verdict, each non-`verified` claim with its gap, missing or stale description evidence, and the commands to reproduce. Never post secrets or unverified assertions. Never approve or request changes.

## Safety Rules

- Default `report` mutates nothing on the PR or source.
- Never substitute local refs or uncommitted work for the authoritative PR comparison.
- Never run untrusted PR code with access to credentials or shared systems.
- Never write evidence into the PR body that was not observed at the current head.
- Never add image or video files to the repository. Screenshots reach the PR only through `/pr screenshots`.
- Never approve, merge, mark ready, or change review threads.

## Output Style

Report PR, mode, authoritative range, and overall verdict. Include the base `verification` claim table. Add a description audit table: claim, evidence reference, and `ok`/`missing`/`stale`/`mismatch`, plus screenshot applicability. After a mode run, report the body edit or review URL and the exact next action for each gap.
