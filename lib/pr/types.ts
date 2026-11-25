/** Normalized, I/O-free shapes the classifier works on. */

export type Kind =
  | "mergeable"
  | "ci"
  | "comments"
  | "behind"
  | "review-requested"
  | "cleanup"
  | "waiting"
  /** Moving a Blocked Orca worktree out once its unblock conditions hold. Never a classification. */
  | "unblock"
  /** Syncing a development worktree's Orca board column. Never a classification. */
  | "worktree-status";

/** Spec priority order, most urgent first. */
export const KIND_PRIORITY: readonly Kind[] = [
  "mergeable",
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
  id: string;
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
  /** Recent PR commits in GitHub's chronological order, when available. */
  commitOids?: string[];
  /** Head branch name; `null` when unknown. */
  branch?: string | null;
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
  /** `headSha` is the PR's head commit, `null` when unknown. */
  pr: { number: number; state: string; title: string; url: string; headSha: string | null };
  /** Count of `git status --porcelain` lines, `null` when unknown. */
  dirtyFiles: number | null;
}

/** One reason an own PR needs action, with optional detail (job ids or a timestamp). */
export interface Trigger {
  kind: "comments" | "ci" | "behind" | "merge";
  detail?: string;
}

export type Owner = "you" | "prflow" | "agent" | "agent reviewer" | "others";

export interface Classification {
  /** Read-only annotation from the shared PR run-state store. Never affects classification or dispatch. */
  runState?: { packetVerdict: string | null; packetHead: string | null; roundsUsed: number; lastCompletion: string | null };
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
  /** Informational text shown on the report row, such as an approval's body. */
  notes?: string[];
  /** Some check on the head is still running (PRs only). */
  checksPending?: boolean;
  /** True for drafts; they have no author triggers but stay listed during dispatches. */
  isDraft?: boolean;
  /** Review request on a PR another human already approved with no changes requested. */
  lowPriority?: boolean;
}
