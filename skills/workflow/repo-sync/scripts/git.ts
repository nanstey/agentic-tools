/**
 * The only git commands repo-sync runs. Builders reject unsafe inputs.
 * Remote-tracking refs are spelled in full so a tag or local branch named `origin/<b>` cannot shadow them.
 */

/** A plain branch name: no option prefix, no `..`, no control, ref-spec, or glob characters. */
export function safeBranch(b: string): boolean {
  return (
    /^[A-Za-z0-9._/-]+$/.test(b) &&
    !b.startsWith("-") &&
    !b.startsWith("/") &&
    !b.endsWith("/") &&
    !b.endsWith(".") &&
    !b.endsWith(".lock") &&
    !b.includes("..") &&
    !b.includes("//") &&
    b !== "HEAD"
  );
}

/** A full SHA-1 or SHA-256 object name. */
export const safeSha = (s: string): boolean => /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(s);

const branch = (b: string): void => { if (!safeBranch(b)) throw new Error(`repo-sync: unsafe branch name: ${b}`); };
const sha = (s: string): void => { if (!safeSha(s)) throw new Error(`repo-sync: unsafe SHA: ${s}`); };
const currentBranchArgs = (): string[] => ["rev-parse", "--abbrev-ref", "HEAD"];
const originHeadArgs = (): string[] => ["rev-parse", "--abbrev-ref", "refs/remotes/origin/HEAD"];
const indexLockArgs = (): string[] => ["rev-parse", "--git-path", "index.lock"];
const headShaArgs = (): string[] => ["rev-parse", "HEAD"];
const statusArgs = (): string[] => ["--no-optional-locks", "status", "--porcelain"];
const originUrlArgs = (): string[] => ["remote", "get-url", "origin"];
const fetchArgs = (b: string): string[] => { branch(b); return ["fetch", "origin", b]; };
const mergeArgs = (b: string): string[] => { branch(b); return ["merge", "--ff-only", "--no-overwrite-ignore", `refs/remotes/origin/${b}`]; };
const countArgs = (b: string): string[] => { branch(b); return ["rev-list", "--left-right", "--count", `HEAD...refs/remotes/origin/${b}`]; };
const logArgs = (from: string, to: string): string[] => { sha(from); sha(to); return ["log", "--oneline", "--no-decorate", "-n", "10", `${from}..${to}`]; };
const diffArgs = (from: string, to: string): string[] => { sha(from); sha(to); return ["diff", "--name-only", from, to]; };

export const gitArgs = {
  currentBranch: currentBranchArgs,
  originHead: originHeadArgs,
  headSha: headShaArgs,
  indexLock: indexLockArgs,
  status: statusArgs,
  originUrl: originUrlArgs,
  fetch: fetchArgs,
  merge: mergeArgs,
  count: countArgs,
  log: logArgs,
  diff: diffArgs,
};
