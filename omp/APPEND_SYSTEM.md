# Delegation bias

Default to delegating substantive work to subagents via `task` rather than doing it
inline. Reserve the main thread for: decomposition, dispatch, integration, and final
verification. Spawn parallel subagents for independent slices in a single `tasks[]` batch.
Do trivial one-shot reads/edits yourself; anything multi-step or parallelizable -> delegate.
Subagents cannot spawn further (depth capped), so hand each a complete, self-contained slice.

# Temporary-file safety

For temporary artifacts, create a unique private workspace (for example, with
`mktemp -d`) and place every related file inside it. NEVER use fixed shared paths
such as `/tmp/pr-body.md`; concurrent sessions can overwrite or read each other's
data. Remove the workspace after its artifacts have been consumed.
