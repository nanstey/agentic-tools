/**
 * Board column rules for development worktrees. Pure: no I/O.
 *
 * A running session wins: In Progress. Otherwise the worktree's PR decides.
 * The shared open-PR mapping is in lib/pr-state.ts. A draft PR, or no PR,
 * leaves the card where it is (`null`).
 */
import { checkState, prColumn } from "../../../../../lib/pr-state.ts";
import { unansweredFeedback } from "./classify.ts";
import type { PrSnapshot } from "./types.ts";

export type Column = "in-progress" | "needs-attention" | "in-review" | "done";

export interface ColumnDecision {
  state: Column;
  reason: string;
}

/** A worktree whose PR is no longer open (from the scan's cleanup candidates). */
export interface ClosedPr {
  number: number;
  state: string;
}

/** Column for an open PR (`null` for a draft, which waits on its author). */
export function openPrColumn(pr: PrSnapshot): ColumnDecision | null {
  if (pr.isDraft) return null;
  const feedback = pr.role === "author" && unansweredFeedback(pr, pr.account) !== null;
  const checks = pr.checks.map((check) => check.typename === "CheckRun"
    ? checkState({ __typename: "CheckRun", status: check.status, conclusion: check.conclusion })
    : checkState({ __typename: "StatusContext", state: check.state }));
  return prColumn({ number: pr.number, reviewDecision: pr.reviewDecision, mergeStateStatus: pr.mergeStateStatus, checks, feedback });
}

export function closedPrColumn(pr: ClosedPr): ColumnDecision | null {
  if (pr.state === "MERGED") return { state: "done", reason: `PR #${pr.number} merged` };
  if (pr.state === "CLOSED") return { state: "needs-attention", reason: `PR #${pr.number} closed without merging` };
  return null;
}

/** The column for one worktree. `running` names the busy session or open dispatch, if any. */
export function worktreeColumn(running: string | null, open: PrSnapshot | null, closed: ClosedPr | null): ColumnDecision | null {
  if (running !== null) return { state: "in-progress", reason: running };
  if (open) return openPrColumn(open);
  if (closed) return closedPrColumn(closed);
  return null;
}

/** Whether `list` names the repo by any of `keys` (folder name, repo name, `owner/repo`), case-insensitive. */
export function isIgnored(list: readonly string[], keys: readonly string[]): boolean {
  const want = new Set(keys.filter(Boolean).map((k) => k.toLowerCase()));
  return list.some((r) => want.has(r.toLowerCase()));
}
