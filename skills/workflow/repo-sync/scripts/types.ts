/** Shared types. Pure, no I/O. */

/** Why a checkout was left alone. */
export type SkipReason = "dirty" | "not-on-default" | "ahead" | "diverged" | "no-remote" | "no-default-branch" | "fetch-failed" | "locked";

/**
 * Why an attempted step failed. `merge-failed`: the fast-forward was refused and changed nothing.
 * `merge-interrupted`: the merge stopped partway and left a lock or changed paths. `error`: git cannot read the checkout.
 */
export type FailReason = "merge-failed" | "merge-interrupted" | "error";

export type Status = "up-to-date" | "updated" | "would-update" | "skipped" | "failed";

/** One Orca-tracked repo's main checkout. */
export interface Repo {
  id: string;
  /** Absolute path of the main checkout. */
  path: string;
  name: string;
  /** `owner/repo` from the remote URL, or `null`. */
  slug: string | null;
  remoteName: string | null;
  remoteUrl: string | null;
  /** Orca base ref, for example `origin/main`. */
  baseRef: string | null;
}

export interface RepoResult {
  path: string;
  name: string;
  slug: string | null;
  status: Status;
  reason?: SkipReason | FailReason;
  detail?: string;
  branch?: string;
  defaultBranch?: string;
  /** `ssh`, `https as <login>`, `https (ambient)`, or `local`. */
  auth: string;
  /** Commits pulled (`updated`) or waiting (`would-update`). */
  commits?: number;
  from?: string;
  to?: string;
  /** `git log --oneline` of new commits, for repos in `reportChanges`. */
  log?: string[];
  /** Changed paths (first 15), for repos in `reportChanges`. */
  paths?: string[];
  totalPaths?: number;
}

export interface RepoState {
  name: string;
  slug: string | null;
  status: Status;
  reason?: SkipReason | FailReason;
  detail?: string;
  /** Consecutive runs with this status and reason. 0 for healthy repos. */
  streak: number;
  /** The current streak was already printed. */
  reported: boolean;
  at: string;
  commits?: number;
}

export interface LastRun {
  version: 1;
  at: string;
  repos: Record<string, RepoState>;
}

export interface Event {
  at: string;
  kind: "run" | "updated" | "skipped" | "failed";
  repo?: string;
  path?: string;
  reason?: string;
  detail?: string;
  from?: string;
  to?: string;
  commits?: number;
  counts?: { updated: number; upToDate: number; skipped: number; failed: number };
}
