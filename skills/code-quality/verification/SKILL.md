---
name: verification
description: Verifies the basic claims of a changeset by seeking executed evidence that the change achieved its stated goal. Use when a change, branch, or diff claims an outcome and that claim needs proof before it is trusted.
argument-hint: "[claim-or-goal] [base..head]"
user-invocable: true
disable-model-invocation: false
---

# Verification

## Core Contract

Decide whether a changeset achieved its stated goal, using evidence, not assertion. A claim is supported only by an observed result: a test run, command output, API response, log, or screenshot captured from the changed code. Read-only on source: never edit, commit, or push. Follow `CLAUDE.md` / `AGENTS.md` on conflict. Write prose using `terse`.

This skill checks claims. It is not a code review. Use `risk-review` for defect hunting.

## Required Inputs

1. Changeset: explicit `base..head`, else the current branch against its merge base, else the working-tree diff. Record the exact refs.
2. Stated goal and claims: from the invocation, else commit messages, PR description, linked issue, plan, or docs. Without any source, derive claims from the diff and label them `inferred`.

## Workflow

1. **Extract claims.** List each claim as one falsifiable sentence (for example "pagination returns 20 items", "login no longer crashes on empty email"). Merge duplicates. Mark each `stated` or `inferred`.
2. **Map to the change.** For each claim, cite the changed files and lines that should produce the outcome. A claim with no supporting change is `unsupported`.
3. **Choose evidence.** For each claim pick the cheapest observation that would fail if the claim were false:
   - Existing or new automated test that exercises the behavior.
   - Direct execution: run the command, call the endpoint, or load the page.
   - Before/after comparison: observe the base ref failing and the head ref passing, using a detached worktree for the base.
   - Visual claim: screenshot or clip through `visual-capture`.
   - Static evidence (types, schema, config) only when behavior cannot be run. Label it `static`.
4. **Gather evidence.** Run checks against the head ref. Capture the command, exit status, and the relevant output lines. Check that a passing test really covers the claim: it must fail or be absent without the change. A green suite that never touches the changed path is not evidence.
5. **Judge each claim:**
   - `verified`: observed evidence demonstrates the outcome.
   - `partial`: part of the claim is shown. State what is missing.
   - `unverified`: no evidence obtained. State why (cannot run, no environment, no test).
   - `contradicted`: evidence shows the claim is false.
   - `unsupported`: the diff does not implement the claim.
6. **Report.** Give the overall verdict: `achieved` (all material claims verified), `not_achieved` (any contradicted or unsupported), or `inconclusive` (otherwise).

## Implementation Notes

- Use a detached worktree (`git worktree add --detach <temp> <ref>`) for base-ref comparisons. Remove it when done. Never switch, reset, or stash the user's checkout.
- Prefer the narrowest check. Run the full suite only when the claim is broad.
- Keep credentials, tokens, and personal data out of captured evidence.
- Flaky result: rerun once. Report both outcomes if they differ.

## Safety Rules

- Never mark a claim `verified` from the diff, a commit message, or a PR description alone.
- Never treat a passing check as evidence until you confirm it covers the claim.
- Never edit source, tests, or config to make a claim pass.
- Never run destructive commands or touch shared systems or production data to gather evidence.
- Never hide `unverified` claims or inconclusive checks to produce a cleaner verdict.

## Output Style

Start with the verdict and refs. Then give one table row per claim: claim, status, evidence (command and result, or artifact path), and gap. End with the commands needed to reproduce each result and the next action for any claim that is not `verified`.
