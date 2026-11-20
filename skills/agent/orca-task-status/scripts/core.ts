/** Pure decisions for orca-task-status: board state from the agent outcome, PR, and checkout. */

export const STATES = ["paused", "blocked", "in-progress", "needs-attention", "in-review", "done"] as const;
export type State = (typeof STATES)[number];

/** What the agent reports about its own response at the end of it. */
export const OUTCOMES = ["finished", "needs-input", "blocked", "paused"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const isState = (v: string): v is State => (STATES as readonly string[]).includes(v);
export const isOutcome = (v: string): v is Outcome => (OUTCOMES as readonly string[]).includes(v);

export type CheckState = "pass" | "fail" | "pending";

export interface Pr {
  number: number;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  mergedAt: string | null;
  /** APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED, or "" when no review is required. */
  reviewDecision: string;
  /** CLEAN, BLOCKED, BEHIND, DIRTY, DRAFT, HAS_HOOKS, UNKNOWN, UNSTABLE. */
  mergeStateStatus: string;
  headRefOid: string;
  checks: CheckState[];
}

export interface Local {
  /** `git status --porcelain` is non-empty (untracked files included). */
  dirty: boolean;
  head: string;
}

export interface Decision {
  state: State;
  reason: string;
}

const FAILED_CONCLUSIONS = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "STALE"]);
const PASSED_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

/** One `statusCheckRollup` entry (CheckRun or StatusContext) as pass, fail, or pending. */
export function checkState(entry: Record<string, unknown>): CheckState {
  if (entry.__typename === "StatusContext" || ("state" in entry && !("conclusion" in entry))) {
    const s = String(entry.state ?? "");
    if (s === "SUCCESS") return "pass";
    if (s === "FAILURE" || s === "ERROR") return "fail";
    return "pending";
  }
  if (entry.status !== "COMPLETED") return "pending";
  const c = String(entry.conclusion ?? "");
  if (FAILED_CONCLUSIONS.has(c)) return "fail";
  if (PASSED_CONCLUSIONS.has(c)) return "pass";
  return "pending";
}

/** Parse `gh pr view --json number,state,isDraft,mergedAt,reviewDecision,mergeStateStatus,headRefOid,statusCheckRollup`. */
export function parsePr(json: string): Pr {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const state = String(raw.state);
  if (state !== "OPEN" && state !== "CLOSED" && state !== "MERGED") throw new Error(`unexpected PR state "${state}"`);
  if (typeof raw.number !== "number") throw new Error("PR number missing");
  const rollup = Array.isArray(raw.statusCheckRollup) ? (raw.statusCheckRollup as Record<string, unknown>[]) : [];
  return {
    number: raw.number,
    state,
    isDraft: raw.isDraft === true,
    mergedAt: typeof raw.mergedAt === "string" && raw.mergedAt !== "" ? raw.mergedAt : null,
    reviewDecision: typeof raw.reviewDecision === "string" ? raw.reviewDecision : "",
    mergeStateStatus: typeof raw.mergeStateStatus === "string" ? raw.mergeStateStatus : "UNKNOWN",
    headRefOid: typeof raw.headRefOid === "string" ? raw.headRefOid : "",
    checks: rollup.map(checkState),
  };
}

/** Board state from the PR and checkout once the agent has finished its work. */
export function prDecision(pr: Pr | null, local: Local): Decision {
  if (pr === null) return { state: "needs-attention", reason: "no PR for this branch; waiting for instructions" };
  const n = `PR #${pr.number}`;
  if (pr.state === "MERGED") return { state: "done", reason: `${n} merged` };
  if (pr.state === "CLOSED") return { state: "needs-attention", reason: `${n} closed without merging` };
  if (local.dirty) return { state: "needs-attention", reason: "uncommitted changes in the worktree" };
  if (pr.headRefOid && local.head !== pr.headRefOid) return { state: "needs-attention", reason: `local HEAD differs from the ${n} head` };
  if (pr.isDraft) return { state: "needs-attention", reason: `${n} is a draft` };
  if (pr.checks.includes("fail")) return { state: "needs-attention", reason: `${n} has failing checks` };
  if (pr.reviewDecision === "CHANGES_REQUESTED") return { state: "needs-attention", reason: `${n} has changes requested` };
  if (pr.mergeStateStatus === "DIRTY") return { state: "needs-attention", reason: `${n} has merge conflicts` };
  if (pr.checks.includes("pending")) return { state: "in-review", reason: `${n} is waiting for checks` };
  const approved = pr.reviewDecision === "APPROVED" || pr.reviewDecision === "";
  if (approved && (pr.mergeStateStatus === "CLEAN" || pr.mergeStateStatus === "HAS_HOOKS"))
    return { state: "done", reason: `${n} is ready to merge` };
  return { state: "in-review", reason: `${n} is waiting for review or merge (${pr.mergeStateStatus.toLowerCase()})` };
}

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
  if (pausedId && wt.workspaceStatus === pausedId) return "task is paused";
  if (wt.childWorktreeIds.length > 0) return "worktree has child worktrees";
  if (pr === null) return "no PR for this branch";
  if (pr.state !== "MERGED" || pr.mergedAt === null) return `PR #${pr.number} is not merged`;
  if (local.dirty) return "uncommitted changes in the worktree";
  if (!pr.headRefOid || local.head !== pr.headRefOid) return `local HEAD has commits that are not in merged PR #${pr.number}`;
  return null;
}
