/** Shared GitHub check parsing and board placement for PR facts. */

export type CheckState = "pass" | "fail" | "cancelled" | "pending";

const FAILED_CONCLUSIONS = new Set(["FAILURE", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "STALE"]);
const PASSED_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

/** Parse one `statusCheckRollup` entry (CheckRun or StatusContext). */
export function checkState(entry: Record<string, unknown>): CheckState {
  if (entry.__typename === "StatusContext" || ("state" in entry && !("conclusion" in entry))) {
    const state = String(entry.state ?? "");
    if (state === "SUCCESS") return "pass";
    if (state === "FAILURE" || state === "ERROR") return "fail";
    return "pending";
  }
  if (entry.status !== "COMPLETED") return "pending";
  const conclusion = String(entry.conclusion ?? "");
  if (conclusion === "CANCELLED") return "cancelled";
  if (FAILED_CONCLUSIONS.has(conclusion)) return "fail";
  if (PASSED_CONCLUSIONS.has(conclusion)) return "pass";
  return "pending";
}

export type PrColumn = "needs-attention" | "in-review" | "done";

export interface PrColumnFacts {
  number: number;
  reviewDecision: string | null;
  mergeStateStatus: string;
  checks: CheckState[];
  /** Unanswered review feedback, when the caller can determine it. Defaults to false. */
  feedback?: boolean;
}

export interface PrColumnDecision {
  state: PrColumn;
  reason: string;
}

/** Shared board placement from open-PR GitHub facts; this does not define PR readiness. */
export function prColumn(pr: PrColumnFacts): PrColumnDecision {
  const n = `PR #${pr.number}`;
  if (pr.checks.includes("fail")) return { state: "needs-attention", reason: `${n} has failing checks` };
  if (pr.mergeStateStatus === "DIRTY") return { state: "needs-attention", reason: `${n} has merge conflicts` };
  if (pr.reviewDecision === "CHANGES_REQUESTED") return { state: "needs-attention", reason: `${n} has changes requested` };
  if (pr.feedback) return { state: "needs-attention", reason: `${n} has unanswered review comments` };
  if (pr.checks.includes("pending")) return { state: "in-review", reason: `${n} is waiting for checks` };
  if (pr.checks.includes("cancelled")) return { state: "in-review", reason: `${n} has cancelled checks` };
  const approved = pr.reviewDecision === "APPROVED" || pr.reviewDecision === "" || pr.reviewDecision === null;
  if (approved && (pr.mergeStateStatus === "CLEAN" || pr.mergeStateStatus === "HAS_HOOKS"))
    return { state: "done", reason: `${n} is ready to merge` };
  return { state: "in-review", reason: `${n} is waiting for review or merge (${pr.mergeStateStatus.toLowerCase()})` };
}
