import { checkState } from "../pr-state.ts";
import type { Actor, Check, PrSnapshot, Review } from "./types.ts";

export interface CheckSummary {
  pending: boolean;
  /** Failed job ids. */
  failed: string[];
  cancelled: string[];
  total: number;
  requiredPending: number;
}

/** Job id: last URL path segment, else the check name. */
export function jobId(url: string | null, name: string): string {
  return (url ?? "").replace(/.*\//, "") || name;
}

/** Summarize checks. Every check counts the same; repo-specific caveats belong in each repo's docs. */
export function summarizeChecks(checks: Check[]): CheckSummary {
  const s: CheckSummary = { pending: false, failed: [], cancelled: [], total: checks.length, requiredPending: 0 };
  for (const c of checks) {
    const state = c.typename === "CheckRun"
      ? checkState({ __typename: "CheckRun", status: c.status, conclusion: c.conclusion })
      : checkState({ __typename: "StatusContext", state: c.state });
    if (state === "pending") {
      s.pending = true;
      if (c.isRequired) s.requiredPending++;
      continue;
    }
    const id = jobId(c.url, c.name);
    if (state === "fail") s.failed.push(id);
    else if (state === "cancelled") s.cancelled.push(id);
  }
  return s;
}

const human = (a: Actor, me: string): boolean => a !== null && a.typename !== "Bot" && a.login !== me;
const mine = (a: Actor, me: string): boolean => a !== null && a.login === me;
const maxOf = (xs: string[]): string => xs.reduce((m, x) => (x > m ? x : m));
const CHANGES_ASKED = /\bchanges?\s+(?:needed|requested|required)\b|\brequest(?:ed|ing)?\s+changes\b|\bplease\s+(?:fix|change|address)\b/i;

/** An approval whose body asks for no changes is informational. */
export function informationalApproval(r: Review): boolean {
  return r.state === "APPROVED" && !CHANGES_ASKED.test(r.body);
}

/** Latest unanswered human feedback newer than the head commit, or `null`. */
function feedbackTimes(pr: PrSnapshot, me: string): { ours: string[]; theirs: string[] } {
  const ours: string[] = [];
  const theirs: string[] = [];
  collectCommentTimes(pr, me, ours, theirs);
  collectReviewTimes(pr, me, ours, theirs);
  collectThreadTimes(pr, me, theirs);
  return { ours, theirs };
}
function collectCommentTimes(pr: PrSnapshot, me: string, ours: string[], theirs: string[]): void {
  for (const comment of pr.comments) {
    if (human(comment.author, me)) theirs.push(comment.at);
    else if (mine(comment.author, me)) ours.push(comment.at);
  }
}
function collectReviewTimes(pr: PrSnapshot, me: string, ours: string[], theirs: string[]): void {
  for (const review of pr.reviews) {
    if (review.at === null) continue;
    if (human(review.author, me) && !informationalApproval(review) && (review.body !== "" || review.state === "CHANGES_REQUESTED")) theirs.push(review.at);
    else if (mine(review.author, me)) ours.push(review.at);
  }
}
function collectThreadTimes(pr: PrSnapshot, me: string, theirs: string[]): void {
  for (const thread of pr.threads) {
    const last = thread.comments.at(-1);
    if (!thread.isResolved && last && human(last.author, me)) theirs.push(last.at);
  }
}
export function unansweredFeedback(pr: PrSnapshot, me: string): string | null {
  const { ours, theirs } = feedbackTimes(pr, me);
  const newer = theirs.filter((time) => time > pr.headCommittedDate);
  if (newer.length === 0) return null;
  const latest = maxOf(newer);
  return ours.length > 0 && maxOf(ours) > latest ? null : latest;
}
