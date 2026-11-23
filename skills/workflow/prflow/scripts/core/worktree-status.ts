/**
 * Board column rules for development worktrees. Pure: no I/O.
 *
 * A running session wins: In Progress. Otherwise the worktree's PR decides:
 * merged, or ready to merge (prflow's `merge-ready`): Done; closed unmerged,
 * failing checks, a merge conflict, changes requested, or unanswered review
 * feedback: Needs Attention; any other open PR: In Review. No PR, or a draft
 * PR, leaves the card where it is (`null`).
 */
import { summarizeChecks, unansweredFeedback } from "./classify.ts";
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
  const n = `PR #${pr.number}`;
  if (pr.isDraft) return null;
  const s = summarizeChecks(pr.checks);
  if (s.failed.length) return { state: "needs-attention", reason: `${n} has failing checks` };
  if (pr.mergeStateStatus === "DIRTY") return { state: "needs-attention", reason: `${n} has merge conflicts` };
  if (pr.reviewDecision === "CHANGES_REQUESTED") return { state: "needs-attention", reason: `${n} has changes requested` };
  if (pr.role === "author" && unansweredFeedback(pr, pr.account) !== null) return { state: "needs-attention", reason: `${n} has unanswered review comments` };
  if (!s.pending && !s.cancelled.length && pr.mergeStateStatus === "CLEAN" && pr.reviewDecision === "APPROVED")
    return { state: "done", reason: `${n} is ready to merge` };
  if (s.pending) return { state: "in-review", reason: `${n} is waiting for checks` };
  return { state: "in-review", reason: `${n} is waiting for review or merge (${pr.mergeStateStatus.toLowerCase()})` };
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
