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
const bot = (a: Actor): boolean => a !== null && a.typename === "Bot";

/**
 * True when a review asks for an answer: a human's non-informational review
 * with text or a change request, or a bot's change request. A bot's COMMENTED
 * review only summarizes its inline threads, which count on their own;
 * counting the summary too would retrigger after every thread reply.
 */
export function reviewFeedback(r: Pick<Review, "author" | "state" | "body">, me: string): boolean {
  if (human(r.author, me)) return !informationalApproval(r) && (r.body !== "" || r.state === "CHANGES_REQUESTED");
  return bot(r.author) && r.state === "CHANGES_REQUESTED";
}

/** True when the last comment of an unresolved thread by `a` waits for an answer: a human's or a bot's. */
export function threadFeedback(a: Actor, me: string): boolean {
  return human(a, me) || bot(a);
}
const mine = (a: Actor, me: string): boolean => a !== null && a.login === me;
const maxOf = (xs: string[]): string => xs.reduce((m, x) => (x > m ? x : m));
const CHANGES_ASKED = /\bchanges?\s+(?:needed|requested|required)\b|\brequest(?:ed|ing)?\s+changes\b|\bplease\s+(?:fix|change|address)\b/i;

/** An approval whose body asks for no changes is informational. */
export function informationalApproval(r: Pick<Review, "state" | "body">): boolean {
  return r.state === "APPROVED" && !CHANGES_ASKED.test(r.body);
}

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
    if (reviewFeedback(review, me)) theirs.push(review.at);
    else if (mine(review.author, me)) ours.push(review.at);
  }
}
function collectThreadTimes(pr: PrSnapshot, me: string, theirs: string[]): void {
  for (const thread of pr.threads) {
    const last = thread.comments.at(-1);
    if (!thread.isResolved && last && threadFeedback(last.author, me)) theirs.push(last.at);
  }
}

/**
 * Latest unanswered feedback newer than the head commit, or `null`. Feedback is
 * a human's, or any bot's change request or unresolved inline thread.
 * Bot issue comments (such as a walkthrough summary) never count.
 */
export function unansweredFeedback(pr: PrSnapshot, me: string): string | null {
  const { ours, theirs } = feedbackTimes(pr, me);
  const newer = theirs.filter((time) => time > pr.headCommittedDate);
  if (newer.length === 0) return null;
  const latest = maxOf(newer);
  return ours.length > 0 && maxOf(ours) > latest ? null : latest;
}
