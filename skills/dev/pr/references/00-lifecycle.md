# PR lifecycle

## Phases

`pr next` evaluates listed deterministic tests; a judgment result is returned for an agent to resolve. Run the first unmet phase, then snapshot and evaluate again.

| # | Phase | Entry test | Action | Evaluation |
| --- | --- | --- | --- | --- |
| 0 | Resolve | PR facts not resolved | `pr snapshot`; identify target/owner | Agent |
| 1 | Create | PR absent | `/pr create` | `pr next` |
| 2 | Publish | unpushed commits or validated dirty tree | `/pr push` | `pr next` |
| 3 | Describe | placeholder, stale body, or missing UI evidence | `/pr description`, `/pr screenshots` | Staleness and UI evidence: judgment |
| 4 | Sync | behind, conflict, or stack out of order | `/pr rebase`, `/pr restack`, `/pr stack` | `pr next` |
| 5 | CI | no observed checks or required check failed/missing | `/pr ci` | Required-check policy: judgment; data from `pr checks inventory` |
| 6 | Review | no complete matching packet or docs-only evidence | `/pr review fix` (own PR) | `pr next` |
| 7 | Threads | unresolved threads or reviewers need rerequest | `/pr comments` | `pr next` |
| 8 | Verify | claims lack cited evidence | `/pr verification fix` (own PR) | `pr next` |
| 9 | Ready | PR is draft after preceding phases pass | `/pr ready` | `pr next` |
| 10 | Merge | `automerge` requested | `/pr merge` | `pr next` |

## Transitions

Start with `pr run start --pr <target> --action <action> [--mode <mode>] [--force]`. Reserve each fix round with `pr run update --pr <target> --run <id> --round <n>`, then end the run with `pr run end --pr <target> --run <id> --completion <complete|pending|forced|blocked>`. After a merge, merge records completion; do not run `run end` afterward, and run cleanup last. Use `pr next --judged <name>=pass|fail` with exact names `description-staleness`, `ui-evidence`, `required-check-policy`, and `claims-verification-evidence`. Run phases in order and continue after each action. A head or base change requires a fresh snapshot and re-evaluation. After phase 9, reconcile the head once; if it changed, rerun review and affected later phases once. Continued churn is `blocked`. Bare `/pr` ends before phase 10; `automerge` includes it. Never end a `changes_required` result without attempting the fix within the [round limit](_policy.md#round-limit). Ready and merge actions run any missing phase within this run's remaining round budget.

## Completion

- `complete`: final head has complete clean review (or clean docs-only evidence), no unresolved requests or threads, and all required checks passed.
- `pending`: review and threads are current; required CI is still running. Do not merge; report the pending checks for a later scheduled run.
- `forced`: force overrode one or more gates; list each with evidence. Never describe forced as clean.
- `blocked`: required work is impossible, unsafe, or exceeds the run budget; use the blocked form in `_policy.md`.

## Run ownership

Each top-level invocation starts `pr run start` and owns one five-round budget. Phases and delegates inherit its `--run <id>`; never start a nested run or reset the budget. Bare `/pr` and `automerge` use the same budget across phases 5–8. A ready run does missing work within its current run budget. `pr run start` initializes round 0 and limit 5.

## Other authors' PRs

Bare `/pr` resolves the PR (phase 0), runs a report-only review, then stops. A stored `clean` or `changes_required` review packet matching the exact current base and head OIDs and the current non-null policy hash marks that report complete; an `incomplete` packet or a packet with stale policy does not. Phases 1–5 and 7–10 do not apply. Publishing a review requires an explicit mode-less `/pr review` invocation.
