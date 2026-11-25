# PR rebase

Pin rebase intent to the PR base; delegate mechanics to `/git rebase`.

## Inputs

- PR target and optional explicit base when no PR exists.

## Safety

Never rebase `main` or `develop`; create or switch to a feature branch before committing there. Never force-push either branch.

## Steps

1. Resolve with `pr snapshot [target]`; capture base, title, body, and stack membership.
2. For a native stack member, use `/pr stack` instead. If no PR exists, use the explicit base or `/git rebase` base detection.
3. Before a head-changing rebase, apply [draft-before-changes](_policy.md#draft-before-changes). Delegate to `/git rebase` with the PR base pinned.
4. After push, run `/pr push` post-push steps for the new head.

## Output

Report resolved PR/base, delegation, conflicts, and publication result.
