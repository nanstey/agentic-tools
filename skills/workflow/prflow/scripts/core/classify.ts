import { createHash } from "node:crypto";
import { informationalApproval, summarizeChecks, unansweredFeedback } from "../../../../../lib/pr/facts.ts";
export { jobId, summarizeChecks, unansweredFeedback } from "../../../../../lib/pr/facts.ts";
import {
  KIND_PRIORITY,
  type Actor,
  type Classification,
  type Kind,
  type PrSnapshot,
  type Review,
  type Trigger,
  type WorktreeItem,
} from "../../../../../lib/pr/types.ts";

const human = (a: Actor, me: string): boolean => a !== null && a.typename !== "Bot" && a.login !== me;
const mine = (a: Actor, me: string): boolean => a !== null && a.login === me;
export { informationalApproval } from "../../../../../lib/pr/facts.ts";

/** Review body as one line: no HTML comments, no GitHub alert blocks (`> [!NOTE]`), collapsed whitespace. */
export function cleanBody(body: string): string {
  const out: string[] = [];
  let inAlert = false;
  for (const line of body.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    if (/^\s*>\s*\[!\w+\]/.test(line)) {
      inAlert = true;
      continue;
    }
    if (inAlert && /^\s*>/.test(line)) continue;
    inAlert = false;
    out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

/**
 * Bodies of informational approvals to show on the report row: each human
 * reviewer's latest submitted review, when it is such an approval with text.
 */
export function approvalNotes(pr: PrSnapshot, me: string): string[] {
  const latest = new Map<string, Review>();
  for (const r of pr.reviews) {
    if (r.at === null || r.state === "PENDING" || !human(r.author, me)) continue;
    const login = r.author?.login ?? "";
    const prev = latest.get(login);
    if (!prev || (prev.at ?? "") <= r.at) latest.set(login, r);
  }
  const notes: string[] = [];
  for (const [login, r] of latest) {
    const text = cleanBody(r.body);
    if (informationalApproval(r) && text) notes.push(`approved by ${login} ${(r.at ?? "").slice(0, 16).replace("T", " ")}Z: ${clip(text, 400)}`);
  }
  return notes.sort();
}

/** Every trigger that fires for an own PR, in a fixed order. */
export function authorTriggers(pr: PrSnapshot, me: string): Trigger[] {
  if (pr.isDraft) return [];
  const out: Trigger[] = [];
  const latest = unansweredFeedback(pr, me);
  if (latest !== null) out.push({ kind: "comments", detail: latest });
  const s = summarizeChecks(pr.checks);
  if (!s.pending) {
    if (s.failed.length) out.push({ kind: "ci", detail: [...s.failed].sort().join(",") });
    else if (s.cancelled.length) out.push({ kind: "ci", detail: `cancelled: ${[...s.cancelled].sort().join(",")}` });
    else if (pr.mergeStateStatus === "BEHIND" || pr.mergeStateStatus === "DIRTY")
      out.push({ kind: "behind" });
    else if (pr.mergeStateStatus === "CLEAN" && pr.reviewDecision === "APPROVED")
      out.push({ kind: "merge" });
  }
  return out;
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
  merge: "mergeable",
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
  else if (s.cancelled.length) bits.push("checks=cancelled");
  else bits.push("checks=green");
  return bits.join(" ");
}

function authorPlan(kind: Kind, t: Trigger | undefined): Pick<Classification, "nextAction" | "owner"> {
  switch (kind) {
    case "mergeable":
      return { nextAction: "GitHub reports approved, checks green, and merge state CLEAN; run /pr to decide readiness", owner: "you" };
    case "ci":
      return { nextAction: `send PR lifecycle brief (${t?.detail ?? ""})`, owner: "agent" };
    case "comments":
      return { nextAction: `send /pr lifecycle brief (latest ${t?.detail ?? ""})`, owner: "agent" };
    case "behind":
      return { nextAction: "send /pr lifecycle brief", owner: "agent" };
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
    account: pr.account,
    checksPending: summarizeChecks(pr.checks).pending,
    isDraft: pr.isDraft,
  };
}

/** Classify one of the account's own open PRs. */
export function classifyAuthored(pr: PrSnapshot, me: string): Classification {
  const triggers = authorTriggers(pr, me);
  const top = [...triggers].sort((a, b) => rank(TRIGGER_KIND[a.kind]) - rank(TRIGGER_KIND[b.kind]))[0];
  const kind: Kind = top ? TRIGGER_KIND[top.kind] : "waiting";
  const plan = authorPlan(kind, top);
  const others = triggers.filter((t) => t !== top).map((t) => TRIGGER_KIND[t.kind]);
  const status =
    kind === "waiting"
      ? `${waitingReason(pr)}; ${checkStatus(pr)}`
      : `${checkStatus(pr)}${others.length ? ` also: ${others.join(", ")}` : ""}`;
  const notes = approvalNotes(pr, me);
  return { ...base(pr), kind, triggers, status, ...plan, ...(notes.length ? { notes } : {}) };
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
  const approvers = otherApprovals(pr, me);
  const low = approvers.length > 0;
  return {
    ...out,
    kind: "review-requested",
    status: low ? `low priority (already approved by ${approvers.join(", ")}); ${out.status}` : out.status,
    nextAction: "launch reviewer session (draft only, you approve before posting)",
    owner: "agent reviewer",
    ...(low ? { lowPriority: true } : {}),
  };
}

/**
 * Other humans whose latest deciding review (approve, request changes, or
 * dismissed) approves the PR. Empty when anyone's latest deciding review
 * requests changes or GitHub reports changes requested.
 */
export function otherApprovals(pr: PrSnapshot, me: string): string[] {
  if (pr.reviewDecision === "CHANGES_REQUESTED") return [];
  const latest = new Map<string, Review>();
  for (const r of pr.reviews) {
    if (r.at === null || !human(r.author, me) || !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) continue;
    const login = r.author?.login ?? "";
    const prev = latest.get(login);
    if (!prev || (prev.at ?? "") <= r.at) latest.set(login, r);
  }
  const states = [...latest.entries()];
  if (states.some(([, r]) => r.state === "CHANGES_REQUESTED")) return [];
  return states.filter(([, r]) => r.state === "APPROVED").map(([login]) => login).sort();
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
    account: w.account,
    kind: "cleanup",
    triggers: [],
    checksPending: false,
    status: `PR ${w.pr.state}; worktree ${w.path} ${dirty}`,
    nextAction: blocked ? "check uncommitted work before archiving" : "archive worktree",
    owner: blocked ? "you" : "prflow",
  };
}

export function classify(pr: PrSnapshot, me: string): Classification {
  return pr.role === "author" ? classifyAuthored(pr, me) : classifyReviewRequest(pr, me);
}
