# PR run state

## Stored schema

`lib/pr/store.ts` stores version 1 state at the PR identity path. Identity is `{owner, repo, number}`. Runs are keyed by run id and contain `id`, `action`, nullable `mode`, `force`, `startedAt`, `round`, `limit` (default 5), `drafted_for_changes`, and nullable `completion`. Packets contain `base`, `head`, `policy`, `depth`, `reason`, `verdict`, finding `{id, category}` rows, coverage `{path, status}` rows, and `storedAt`. State also stores `describedHeads`, cancelled-check reruns keyed by head, and `lastCompletion`. Runs expire after seven days; review prose and secrets are not stored.

## Packet identity

A reusable packet matches the exact base OID, head OID, and policy hash. The policy hash is SHA-256 over sorted policy-surface file paths and blob OIDs at the PR head, as computed by `scripts/resolve.ts` via `policyHash`.

## Invalidation and reuse

A base or head change invalidates head-bound review, readiness, approval, and other snapshot evidence. A draft conversion invalidates readiness and approval evidence. Reuse requires exact base, head, and policy identity; never reuse a near match.
