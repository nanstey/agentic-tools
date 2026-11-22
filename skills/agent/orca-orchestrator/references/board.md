# Board statuses

The Orca board has one column per workspace status. orca-task-status, prflow, and the orchestrator move worktree cards between columns by status id (`orca-ide worktree set --workspace-status <id>`). Built-in columns have fixed ids. Custom columns get a generated id when you create them, so the ids differ per machine and must be set in the shared config.

## Status set

| Status | Column | Id | Config key | Meaning | Moved there by |
| --- | --- | --- | --- | --- | --- |
| in-progress | In Progress (built-in) | `in-progress` | `taskStatus.statuses.in-progress` (default) | An agent is working on the task | orca-task-status `start` |
| in-review | In Review (built-in) | `in-review` | `taskStatus.statuses.in-review` (default) | The PR waits for CI, reviewers, or merge | orca-task-status `end`; prflow when it moves a card out of Blocked |
| done | Done (built-in) | `completed` | `taskStatus.statuses.done` (default) | The PR is ready to merge (approved, checks green, merge state clean) or merged | orca-task-status `end`; prflow unblock; the orchestrator, only for a worker whose PR is ready or merged |
| paused | Paused (custom) | generated | `taskStatus.statuses.paused` | Work stopped indefinitely, at the user's request | orca-task-status `end --outcome paused`; the user |
| blocked | Blocked (custom) | generated | `taskStatus.statuses.blocked` | Waits on other work, with a recorded unblock condition | orca-task-status `end --outcome blocked`; prflow moves it out once the conditions hold |
| needs-attention | Needs Attention (custom) | generated | `taskStatus.statuses.needs-attention` | Needs the user's input, or a worker reported done and its PR is not ready yet | orca-task-status `end`; prflow unblock; the orchestrator when a worker reports done |
| review-draft | Review Draft (custom) | generated | `prflow.review.statuses.draft` | A review worktree whose PR is still a draft | prflow status sync |
| reviewing | Reviewing (custom) | generated | `prflow.review.statuses.reviewing` | A reviewer session is reviewing the current head, or the posted or drafted verdict is `comment` | prflow status sync; the reviewer session after saving a draft |
| review-changes | Review Changes (custom) | generated | `prflow.review.statuses.changes` | The posted or drafted verdict is request-changes | prflow status sync; the reviewer session |
| review-approved | Review Approved (custom) | generated | `prflow.review.statuses.approved` | The posted or drafted verdict is approve | prflow status sync; the reviewer session |

The `taskStatus` columns hold work worktrees. The `prflow.review` columns hold only prflow review worktrees (`prflow-review/` branches). prflow status sync overwrites manual moves of review worktrees on the next tick. Full rules: orca-task-status `SKILL.md` and prflow `references/review.md`.

## Set up on a new machine

1. In the Orca board, create the seven custom columns: Paused, Blocked, Needs Attention, Review Draft, Reviewing, Review Changes, Review Approved. Orca has no CLI command for this.
2. For each custom column, move any worktree card into it, then read the id from a terminal in that worktree:

   ```sh
   orca-ide worktree current --json   # result.worktree.workspaceStatus, such as "status-7"
   ```

   `orca-ide worktree ps --json` shows the same `workspaceStatus` for every worktree. Move the card back afterwards.
3. Put the ids in the shared config (`config.example.json` shows the shape):

   ```json
   "prflow": { "review": { "statuses": { "draft": "<id>", "reviewing": "<id>", "changes": "<id>", "approved": "<id>" } } },
   "taskStatus": { "statuses": { "paused": "<id>", "blocked": "<id>", "needs-attention": "<id>" } }
   ```

   Leave `in-progress`, `in-review`, and `done` unset to use the built-in ids.
4. Check the file: `node <orca-task-status-dir>/scripts/task-status.ts show`, `node <prflow-dir>/scripts/prflow.ts config`, and `node <orca-orchestrator-dir>/scripts/config.ts` each exit 0.

A `taskStatus` state without an id cannot be written: orca-task-status exits 1 and writes nothing, and prflow reports `needs-decision` instead of moving a card there.
