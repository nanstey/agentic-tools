import { createHash } from "node:crypto";
import {
  KIND_PRIORITY,
  type Actor,
  type Check,
  type Classification,
  type Kind,
  type PrSnapshot,
  type Trigger,
  type WorktreeItem,
} from "./types.ts";

/** Required-action checker jobs: a failure here is never a real CI failure. */
export const CHECKER_NAMES: readonly string[] = [
  "required-action-checker",
  "required-actions-checker",
];

const BAD_CHECK_RUN = ["FAILURE", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED"];
const BAD_STATUS = ["FAILURE", "ERROR"];
const PENDING_STATUS = ["PENDING", "EXPECTED"];

export interface CheckSummary {
  pending: boolean;
  /** Real failures (job ids), checker excluded. */
  failed: string[];
  cancelled: string[];
  checkerFailed: string[];
  total: number;
  requiredPending: number;
}

/** Job id the legacy precheck reports: last URL path segment, else the check name. */
export function jobId(url: string | null, name: string): string {
  return (url ?? "").replace(/.*\//, "") || name;
}

function isPending(c: Check): boolean {
  return c.typename === "CheckRun"
    ? c.status !== "COMPLETED"
    : PENDING_STATUS.includes(c.state);
}

/** Port of the legacy precheck check loop. */
export function summarizeChecks(checks: Check[]): CheckSummary {
  const s: CheckSummary = {
    pending: false,
    failed: [],
    cancelled: [],
    checkerFailed: [],
    total: checks.length,
    requiredPending: 0,
  };
  for (const c of checks) {
    if (isPending(c)) {
      s.pending = true;
      if (c.isRequired) s.requiredPending++;
      continue;
    }
    const conclusion = c.typename === "CheckRun" ? c.conclusion : c.state;
    const bad =
      c.typename === "CheckRun"
        ? BAD_CHECK_RUN.includes(conclusion ?? "")
        : BAD_STATUS.includes(conclusion ?? "");
    const id = jobId(c.url, c.name);
    if (CHECKER_NAMES.includes(c.name)) {
      if (bad) s.checkerFailed.push(id);
    } else if (bad) s.failed.push(id);
    else if (conclusion === "CANCELLED") s.cancelled.push(id);
  }
  return s;
}

const human = (a: Actor, me: string): boolean =>
  a !== null && a.typename !== "Bot" && a.login !== me;
const mine = (a: Actor, me: string): boolean => a !== null && a.login === me;

const maxOf = (xs: string[]): string => xs.reduce((m, x) => (x > m ? x : m));

/**
 * Latest unanswered human feedback newer than the head commit, or `null`.
 * Port of the legacy "comments" rule. Timestamps compare as ISO strings.
 * Divergence: pending reviews (null timestamp) are ignored; legacy crashed on them.
 */
export function unansweredFeedback(pr: PrSnapshot, me: string): string | null {
  const ours: string[] = [];
  const theirs: string[] = [];
  for (const c of pr.comments) {
    if (human(c.author, me)) theirs.push(c.at);
    else if (mine(c.author, me)) ours.push(c.at);
  }
  for (const r of pr.reviews) {
    if (r.at === null) continue;
    if (human(r.author, me) && (r.body !== "" || r.state === "CHANGES_REQUESTED"))
      theirs.push(r.at);
    else if (mine(r.author, me)) ours.push(r.at);
  }
  for (const t of pr.threads) {
    const last = t.comments.at(-1);
    if (!t.isResolved && last && human(last.author, me)) theirs.push(last.at);
  }
  const newer = theirs.filter((t) => t > pr.headCommittedDate);
  if (newer.length === 0) return null;
  const latest = maxOf(newer);
  if (ours.length > 0 && maxOf(ours) > latest) return null;
  return latest;
}

/** Every trigger the legacy precheck would print for this PR, in its order. */
export function legacyTriggers(pr: PrSnapshot, me: string): Trigger[] {
  if (pr.isDraft) return [];
  const out: Trigger[] = [];
  const latest = unansweredFeedback(pr, me);
  if (latest !== null) out.push({ kind: "comments", detail: latest });
  const s = summarizeChecks(pr.checks);
  if (!s.pending) {
    if (s.failed.length) out.push({ kind: "ci", detail: [...s.failed].sort().join(",") });
    else if (s.cancelled.length || s.checkerFailed.length)
      out.push({
        kind: "rerun",
        detail: [...s.cancelled, ...s.checkerFailed].sort().join(","),
      });
    else if (pr.mergeStateStatus === "BEHIND" || pr.mergeStateStatus === "DIRTY")
      out.push({ kind: "behind" });
    else if (pr.mergeStateStatus === "CLEAN" && pr.reviewDecision === "APPROVED")
      out.push({ kind: "merge" });
  }
  return out;
}

export function legacyLine(pr: PrSnapshot, t: Trigger): string {
  const base = `${pr.repo}#${pr.number}@${pr.headSha.slice(0, 8)}:${t.kind}`;
  return t.detail === undefined ? base : `${base}:${t.detail}`;
}

/** `headSha8-digest8`; a new comment, review or thread change on the same head is a new version. */
export function version(pr: PrSnapshot): string {
  const who = (a: Actor) => a?.login ?? "ghost";
  const material = JSON.stringify([
    pr.comments.map((c) => [who(c.author), c.at]),
    pr.reviews.map((r) => [who(r.author), r.state, r.at]),
    pr.threads.map((t) => [t.isResolved, t.comments.map((c) => [who(c.author), c.at])]),
  ]);
  const digest = createHash("sha256").update(material).digest("hex").slice(0, 8);
  return `${pr.headSha.slice(0, 8)}-${digest}`;
}

const TRIGGER_KIND: Record<Trigger["kind"], Kind> = {
  merge: "merge-ready",
  rerun: "rerun",
  ci: "ci",
  comments: "comments",
  behind: "behind",
};

export const rank = (k: Kind): number => KIND_PRIORITY.indexOf(k);

function checkStatus(pr: PrSnapshot): string {
  const s = summarizeChecks(pr.checks);
  const bits = [`merge=${pr.mergeStateStatus}`, `review=${pr.reviewDecision ?? "NONE"}`];
  if (s.total === 0) bits.push("checks=none");
  else if (s.pending) bits.push("checks=pending");
  else if (s.failed.length) bits.push(`checks=failed(${s.failed.length})`);
  else if (s.cancelled.length || s.checkerFailed.length) bits.push("checks=cancelled/checker");
  else bits.push("checks=green");
  return bits.join(" ");
}

function authorPlan(kind: Kind, t: Trigger | undefined): Pick<Classification, "nextAction" | "owner"> {
  switch (kind) {
    case "merge-ready":
      return { nextAction: "notify Noel to merge (prflow never merges)", owner: "you" };
    case "rerun":
      return { nextAction: `gh run rerun --failed (${t?.detail ?? ""})`, owner: "prflow" };
    case "ci":
      return { nextAction: `send CI fix brief (${t?.detail ?? ""})`, owner: "Pi session" };
    case "comments":
      return { nextAction: `send fix-and-reply brief (latest ${t?.detail ?? ""})`, owner: "Pi session" };
    case "behind":
      return { nextAction: "send rebase brief", owner: "Pi session" };
    default:
      return { nextAction: "none", owner: "others" };
  }
}

function waitingReason(pr: PrSnapshot): string {
  if (pr.isDraft) return "draft";
  const s = summarizeChecks(pr.checks);
  if (s.pending) return "checks pending";
  if (pr.reviewDecision !== "APPROVED") return "approval outstanding";
  return `merge state ${pr.mergeStateStatus}`;
}

function base(pr: PrSnapshot) {
  return {
    key: `${pr.repo}#${pr.number}`,
    version: version(pr),
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    role: pr.role,
  };
}

/** Classify one of Noel's own open PRs. */
export function classifyAuthored(pr: PrSnapshot, me: string): Classification {
  const triggers = legacyTriggers(pr, me);
  const top = [...triggers].sort((a, b) => rank(TRIGGER_KIND[a.kind]) - rank(TRIGGER_KIND[b.kind]))[0];
  const kind: Kind = top ? TRIGGER_KIND[top.kind] : "waiting";
  const plan = authorPlan(kind, top);
  const others = triggers.filter((t) => t !== top).map((t) => TRIGGER_KIND[t.kind]);
  const status =
    kind === "waiting"
      ? `${waitingReason(pr)}; ${checkStatus(pr)}`
      : `${checkStatus(pr)}${others.length ? ` also: ${others.join(", ")}` : ""}`;
  return { ...base(pr), kind, triggers, status, ...plan };
}

/** True when `me` submitted a review on the current head commit. */
export function reviewedHead(pr: PrSnapshot, me: string): boolean {
  return pr.reviews.some(
    (r) => mine(r.author, me) && r.at !== null && r.state !== "PENDING" && r.commitOid === pr.headSha,
  );
}

/** Classify a PR where `me` is a requested reviewer. */
export function classifyReviewRequest(pr: PrSnapshot, me: string): Classification {
  const s = summarizeChecks(pr.checks);
  const out = { ...base(pr), triggers: [], status: checkStatus(pr) };
  if (pr.isDraft) return { ...out, kind: "waiting", status: `draft; ${out.status}`, nextAction: "none", owner: "others" };
  if (reviewedHead(pr, me))
    return { ...out, kind: "waiting", status: `head already reviewed; ${out.status}`, nextAction: "none", owner: "others" };
  if (s.requiredPending > 0)
    return { ...out, kind: "waiting", status: `required checks pending; ${out.status}`, nextAction: "none", owner: "others" };
  return {
    ...out,
    kind: "review-requested",
    nextAction: "launch reviewer session (draft only, Noel approves before posting)",
    owner: "Pi reviewer",
  };
}

/** Classify a worktree whose PR is no longer open. Returns `null` for open PRs. */
export function classifyWorktree(w: WorktreeItem): Classification | null {
  if (w.pr.state === "OPEN") return null;
  const dirty = w.dirtyFiles === null ? "dirty=unknown" : `dirty=${w.dirtyFiles}`;
  const blocked = w.dirtyFiles !== 0;
  return {
    key: `${w.repo}#${w.pr.number}`,
    version: w.pr.state,
    repo: w.repo,
    number: w.pr.number,
    title: w.pr.title,
    url: w.pr.url,
    role: "worktree",
    kind: "cleanup",
    triggers: [],
    status: `PR ${w.pr.state}; worktree ${w.path} ${dirty}`,
    nextAction: blocked ? "check uncommitted work before archiving" : "archive worktree",
    owner: blocked ? "you" : "prflow",
  };
}

export function classify(pr: PrSnapshot, me: string): Classification {
  return pr.role === "author" ? classifyAuthored(pr, me) : classifyReviewRequest(pr, me);
}
