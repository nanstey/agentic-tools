/** Normalized, I/O-free shapes the classifier works on. */

export type Kind =
  | "merge-ready"
  | "rerun"
  | "ci"
  | "comments"
  | "behind"
  | "review-requested"
  | "cleanup"
  | "waiting";

/** Spec priority order, most urgent first. */
export const KIND_PRIORITY: readonly Kind[] = [
  "merge-ready",
  "rerun",
  "ci",
  "comments",
  "behind",
  "review-requested",
  "cleanup",
  "waiting",
];

/** A GitHub actor. `null` means a deleted ("ghost") account. */
export type Actor = { login: string; typename: string } | null;

export interface CheckRun {
  typename: "CheckRun";
  name: string;
  status: string;
  conclusion: string | null;
  url: string | null;
  isRequired: boolean;
}

export interface StatusContext {
  typename: "StatusContext";
  name: string;
  state: string;
  url: string | null;
  isRequired: boolean;
}

export type Check = CheckRun | StatusContext;

export interface Comment {
  at: string;
  author: Actor;
}

export interface Review {
  /** `null` while the review is still pending (unsubmitted). */
  at: string | null;
  state: string;
  body: string;
  author: Actor;
  commitOid: string | null;
}

export interface Thread {
  isResolved: boolean;
  comments: Comment[];
}

export type Role = "author" | "reviewer";

export interface PrSnapshot {
  repo: string;
  number: number;
  title: string;
  url: string;
  role: Role;
  /** GitHub login whose search found this PR and whose token fetched it. */
  account: string;
  state: string;
  isDraft: boolean;
  headSha: string;
  headCommittedDate: string;
  mergeStateStatus: string;
  reviewDecision: string | null;
  checks: Check[];
  comments: Comment[];
  reviews: Review[];
  threads: Thread[];
  /** Logins (users) and `team:<slug>` entries currently requested. */
  reviewRequests: string[];
}

/** A non-main Orca worktree whose branch maps to a PR. */
export interface WorktreeItem {
  path: string;
  branch: string;
  repo: string;
  /** Configured account that covers the repo. */
  account: string;
  pr: { number: number; state: string; title: string; url: string };
  /** Count of `git status --porcelain` lines, `null` when unknown. */
  dirtyFiles: number | null;
}

/** One reason an own PR needs action, with optional detail (job ids or a timestamp). */
export interface Trigger {
  kind: "comments" | "ci" | "rerun" | "behind" | "merge";
  detail?: string;
}

export type Owner = "you" | "prflow" | "agent" | "agent reviewer" | "others";

export interface Classification {
  key: string;
  version: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  role: Role | "worktree";
  account: string;
  kind: Kind;
  /** Every trigger that fired (author PRs only). */
  triggers: Trigger[];
  status: string;
  nextAction: string;
  owner: Owner;
}
