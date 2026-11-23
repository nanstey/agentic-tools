/**
 * Orca board task states and the PR-derived state rules. Shared by
 * orca-task-status (an agent ending its response) and prflow (moving a card
 * out of Blocked once its unblock condition holds), so both apply one rule set.
 */

import { checkState, prColumn, type CheckState } from "./pr-state.ts";

export const STATES = ["paused", "blocked", "in-progress", "needs-attention", "in-review", "done"] as const;
export type State = (typeof STATES)[number];

export const isState = (v: string): v is State => (STATES as readonly string[]).includes(v);

/** Orca's built-in board columns. Paused, Blocked, and Needs Attention are custom columns with generated ids. */
export const DEFAULT_STATUSES: Partial<Record<State, string>> = { "in-progress": "in-progress", "in-review": "in-review", done: "completed" };

/**
 * Parse the shared config's `taskStatus` section into status ids per state,
 * starting from `DEFAULT_STATUSES`. `fail` receives the key path below `taskStatus.`.
 */
export function parseTaskStatuses(section: Record<string, unknown>, fail: (msg: string) => never): Partial<Record<State, string>> {
  const statuses: Partial<Record<State, string>> = { ...DEFAULT_STATUSES };
  for (const [key, value] of Object.entries(section)) {
    if (key === "$comment") continue;
    if (key !== "statuses") fail(`unknown key "${key}"`);
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail("statuses must be an object");
    for (const [state, id] of Object.entries(value as Record<string, unknown>)) {
      if (state === "$comment") continue;
      if (!isState(state)) fail(`statuses has unknown state "${state}" (expected ${STATES.join(", ")})`);
      if (typeof id !== "string" || id.length === 0) fail(`statuses.${state} must be a non-empty string`);
      statuses[state as State] = id as string;
    }
  }
  return statuses;
}

export { checkState } from "./pr-state.ts";
export type { CheckState } from "./pr-state.ts";

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
  isCrossRepository?: boolean;
  headRefName?: string;
  checks: CheckState[];
  /** Whether GitHub reports unanswered review feedback; unavailable to gh pr view callers. */
  feedback?: boolean;
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
    // Absent stays undefined, so cleanup refuses unless gh reported `false`.
    ...(typeof raw.isCrossRepository === "boolean" ? { isCrossRepository: raw.isCrossRepository } : {}),
    headRefName: typeof raw.headRefName === "string" ? raw.headRefName : "",
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
  return prColumn({ ...pr, feedback: pr.feedback ?? false });
}
