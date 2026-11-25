# PR info

Resolve one PR and report authoritative metadata. This action is read-only.

## Inputs

- PR URL/number, or current branch.

## Steps

1. Run `pr snapshot [target]` to resolve and fetch complete PR facts.
2. Check that the head branch matches the current branch. For read-only review, report a mismatch as informational.
3. Compare PR changes using its authoritative base and head OIDs. Keep committed changes separate from working-tree changes. Do not diff against a stale local base.
4. Include native-stack membership when present.

## Output

Return `number,title,body,url,headRefName,headRefOid,baseRefName,baseRefOid,state,isDraft,author,mergeStateStatus`, resolution method, stack membership/position when available, and any blocker.
