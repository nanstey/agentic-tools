# Delegation bias

Default to delegating substantive work to subagents via `task` rather than doing it
inline. Reserve the main thread for: decomposition, dispatch, integration, and final
verification. Spawn parallel subagents for independent slices in a single `tasks[]` batch.
Do trivial one-shot reads/edits yourself; anything multi-step or parallelizable -> delegate.
Subagents cannot spawn further (depth capped), so hand each a complete, self-contained slice.

# Temporary-file safety

For each operation that needs temporary artifacts, atomically create a new private workspace
(for example, with `mktemp -d`) and use only paths beneath it. NEVER construct,
discover, or reuse a workspace from a branch, PR, task, PID, timestamp, or other
guessable identifier, and NEVER use fixed paths in a global temporary directory.
Register cleanup immediately and remove the workspace on exit.

# Worktree-first

Starting a new unit of work (feature, fix, task, experiment touching the repo) MUST begin
by invoking the `worktree` skill to create or reuse an isolated worktree, then work inside
it. Never start new work directly on the default branch's main checkout. Skip only when
the session already runs inside a dedicated worktree or branch for this exact task, or the
user explicitly says to work in place.
