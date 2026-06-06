---
name: pr-restack
description: Restacks dependent branches after upstream rebase/merge/force-push changes. Use when a PR stack needs bases realigned.
---

# PR Restack

Rebase a dependent PR stack onto updated upstream branches while preserving each branch's unique commits.

## Workflow

1. Gather inputs: stack order/top branch, known upstream changes, and merge style if known.
2. Fetch and map stack from PR metadata (`headRefName`, `baseRefName`, PR state).
3. Determine root base (bottom PR base) and fast-forward local root base to `origin/<root-base>`.
4. Detect drift per branch (upstream rewritten, merged, advanced, or removed commits).
5. Build a per-branch plan: current base, new base, commits kept/dropped, risks, lease SHA.
6. Present plan and wait for explicit user approval.
7. Create backup refs for every branch before rewriting.
8. Execute bottom-up restack:
   - checkout/reset branch to `origin/<branch>`,
   - delegate rebase mechanics to `/rebase` (transplant mode when needed, `push=false`),
   - let `/conflicts` handle pauses,
   - refresh lockfile when package manifests/lockfile changed,
   - run typecheck before push,
   - verify branch shape (`range-diff`, branch log) against plan,
   - force-push with strict lease only.
9. Update PR base when branch targeting changed.
10. Report one-line result per branch plus backups and follow-ups.

## Safety Rules

- Never execute before user approves the plan.
- Never use plain `--force`; use `--force-with-lease`.
- Never rewrite branches without backup refs.
- Never continue when branch base or intent is ambiguous.
- Stop on non-trivial conflicts or unexpected commit drops and ask.
- Do not proceed to next branch if current branch fails validation.

## Output Style

Report root base used, plan approval status, per-branch `old base -> new base` and `before -> after` SHA, push status, updated PR bases, backups created, and unresolved risks.
