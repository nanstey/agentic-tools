/** Pure decisions for orca-task-status: board state from the agent outcome, PR, and checkout. */

import { prDecision, type Decision, type Local, type Pr } from "../../../../lib/task-status.ts";

export { checkState, isState, parsePr, prDecision, STATES } from "../../../../lib/task-status.ts";
export type { CheckState, Decision, Local, Pr, State } from "../../../../lib/task-status.ts";

/** What the agent reports about its own response at the end of it. */
export const OUTCOMES = ["finished", "needs-input", "blocked", "paused"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const isOutcome = (v: string): v is Outcome => (OUTCOMES as readonly string[]).includes(v);

/** Board state at the end of a response. The agent's own outcome wins over PR state. */
export function endDecision(outcome: Outcome, pr: Pr | null, local: Local): Decision {
  if (outcome === "paused") return { state: "paused", reason: "paused by request" };
  if (outcome === "blocked") return { state: "blocked", reason: "waiting on other work" };
  if (outcome === "needs-input") return { state: "needs-attention", reason: "agent needs input" };
  return prDecision(pr, local);
}

export interface Worktree {
  /** Orca worktree id, `<repoId>::<path>`. */
  id: string;
  path: string;
  /** Branch without `refs/heads/`. */
  branch: string;
  isMainWorktree: boolean;
  workspaceStatus: string;
  /** Orca card comment; "" when none. */
  comment: string;
  childWorktreeIds: string[];
}

/** Parse `orca worktree current --json`. */
export function parseWorktree(json: string): Worktree {
  const raw = JSON.parse(json) as { ok?: boolean; result?: { worktree?: Record<string, unknown> } };
  const wt = raw.result?.worktree;
  if (raw.ok !== true || !wt) throw new Error("orca worktree current returned no worktree");
  if (typeof wt.id !== "string" || !wt.id.includes("::")) throw new Error("worktree id missing");
  if (typeof wt.isMainWorktree !== "boolean") throw new Error("worktree isMainWorktree missing");
  return {
    id: wt.id,
    path: typeof wt.path === "string" ? wt.path : "",
    branch: typeof wt.branch === "string" ? wt.branch.replace(/^refs\/heads\//, "") : "",
    isMainWorktree: wt.isMainWorktree,
    workspaceStatus: typeof wt.workspaceStatus === "string" ? wt.workspaceStatus : "",
    comment: typeof wt.comment === "string" ? wt.comment : "",
    childWorktreeIds: Array.isArray(wt.childWorktreeIds) ? wt.childWorktreeIds.map(String) : [],
  };
}

/** Why this worktree is not this tool's to manage, or null when it is. */
export function skipReason(wt: Worktree): string | null {
  if (wt.isMainWorktree) return "main checkout";
  if (wt.branch.startsWith("prflow-review/")) return "prflow review worktree (prflow owns its status)";
  return null;
}

/** Why the worktree must not be removed, or null when removal is safe. */
export function cleanupBlocker(wt: Worktree, pausedId: string | undefined, pr: Pr | null, local: Local): string | null {
  const skip = skipReason(wt);
  if (skip) return skip;
  if (!pausedId) return "Paused status id is not configured (taskStatus.statuses.paused), so a Paused card cannot be ruled out";
  if (wt.workspaceStatus === pausedId) return "task is paused";
  if (wt.childWorktreeIds.length > 0) return "worktree has child worktrees";
  if (pr === null) return "no PR for this branch";
  if (pr.state !== "MERGED" || pr.mergedAt === null) return `PR #${pr.number} is not merged`;
  if (!pr.headRefOid || local.head !== pr.headRefOid) return `local HEAD has commits that are not in merged PR #${pr.number}`;
  return null;
}
