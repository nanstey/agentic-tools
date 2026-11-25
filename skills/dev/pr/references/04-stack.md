# PR stacks

Use this reference to operate on GitHub native stacked PRs. Native stacks are linear and merge only in GitHub's web UI.

## Inputs

- Operation and target stack, PRs, or branches in bottom-to-top order.
- Repository (`owner/repo`) when linking; trunk override and draft/ready intent when needed.
- For collapse, the intended survivor and trunk. Defaults: top PR survives, preserve commits, keep lower branches.

## Steps

1. Probe capability before acting with `pr stack probe --repo <owner/repo>`. This script checks `gh-stack`, Stacks API support, and the active stack; it reports T1/T2/T3 and maps probe failures to recovery guidance. For a custom SSH host alias, always pass the explicit `--repo` value.

   | Tier | Evidence | Available path |
   | --- | --- | --- |
   | T1 | `gh-stack` extension and Stacks feature | Native CLI operations |
   | T2 | Stacks feature only | REST-supported operations; use `/pr restack` for rebasing |
   | T3 | Stacks feature unavailable | Use `/pr restack` or `/git rebase` |

   On T1, use noninteractive commands with explicit arguments. Never run TUI commands such as `gh stack modify`; to restructure, run `gh stack unstack --local`, `gh stack init <new-order...>`, then `gh stack submit --auto --draft` (use `--open` only when ready was requested). A failed command is not success: handle exit 6 as a branch shared by stacks, 7 as a rebase already in progress, and 8 as a stack lock; do not retry blindly. Probe failures are normalized by the script, but operational `gh stack` commands are direct CLI calls and their failures must be handled from their exit status and stderr.
2. Choose the operation:

   | Operation | Steps |
   | --- | --- |
   | Create/adopt | T1: `gh stack init <branch>...` (explicit branches), then publish as drafts unless ready was requested. |
   | Add layer | T1: `gh stack top`, then `gh stack add <branch>`. Put each change on its owning layer. |
   | Publish | T1: `gh stack submit --auto --draft`. |
   | Sync/rebase | T1: `gh stack sync`, or `gh stack rebase` then `--continue`/`--abort`; resolve conflicts through `/git conflicts`. T2/T3: `/pr restack`. |
   | Mid-stack fix | Check out the layer with `gh stack down` or `gh stack checkout <branch>`, commit the fix on that layer, run `gh stack rebase --upstack`, then return with `gh stack top`. |
   | Link | After confirming PR bases form a bottom-to-top chain, run `pr stack link --run <id> --repo <owner/repo> <bottom-pr> <next-pr> ...`. |
   | Inspect | T1: `gh stack view --json`; T2: `pr snapshot` per PR. Report each branch and PR state. |
   | Collapse | Run `pr stack collapse-check <lower-head> ... <survivor-head>` before collapse. Only proceed when allowed; dissolve stack, retarget the top PR to trunk, close lower PRs with fold-in comments, and refresh the survivor description via `pr body`. Post fold-in comments with `pr disclosure --kind fold`.
   | Dissolve | Only when explicitly requested: `gh stack unstack <stack-number>`. Report PRs that remain stacked. |
3. Before rewriting or pushing any existing PR head, follow [draft-before-changes](_policy.md#draft-before-changes) and the [mutation guard](_policy.md#mutation-guard). For force-pushes, follow [force-push](_policy.md#force-push). Never auto-resolve divergence or delete branches unless requested.
4. After a mutation, inspect the result and run `/pr push` post-push steps for every updated PR head.

## Merge semantics

Merging a stacked PR merges that PR and every unmerged PR below it atomically. Merging a middle PR leaves PRs above it open; merging the bottom merges only that PR. Only contiguous groups from the lowest unmerged PR can land. GitHub retargets remaining PRs after a partial merge. A fully merged stack cannot be extended. Merging stacked PRs is web-UI only: give the user the PR URL, and state that the requested PR merges every unmerged PR below it.

## Safety rules

- Never act before `pr stack probe` or fake native-stack behavior at T3.
- Never use interactive TUI commands, plain `--force`, or unrequested pruning, unstacking, or collapse.
- Never collapse until `pr stack collapse-check` confirms every lower head is an ancestor of the survivor and the tree is clean.
- Never create a linked stack until PR bases form the required chain.
- Never rewrite a dirty tree, resolve conflicts inline, or silently resolve stack divergence.

## Output

Report tier and probe evidence, operation, per-branch/PR outcomes, stack number and URL when known, conflict or fallback status, merge impact, and follow-ups.
