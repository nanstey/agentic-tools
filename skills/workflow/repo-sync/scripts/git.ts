/**
 * The only git commands repo-sync runs. Each builder returns exact arguments,
 * and `assertGit` rejects anything else before a process starts.
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

function branchOf(args: readonly string[], i: number, prefix: string): string {
  const v = args[i] ?? "";
  return v.startsWith(prefix) ? v.slice(prefix.length) : "";
}

const currentBranchArgs = (): string[] => ["rev-parse", "--abbrev-ref", "HEAD"];
const originHeadArgs = (): string[] => ["rev-parse", "--abbrev-ref", "origin/HEAD"];
const headShaArgs = (): string[] => ["rev-parse", "HEAD"];
const verifyRemoteArgs = (b: string): string[] => ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${b}`];
const statusArgs = (): string[] => ["status", "--porcelain"];
const fetchArgs = (b: string): string[] => ["fetch", "origin", b];
const mergeArgs = (b: string): string[] => ["merge", "--ff-only", `origin/${b}`];
const countArgs = (b: string): string[] => ["rev-list", "--left-right", "--count", `HEAD...origin/${b}`];
const logArgs = (from: string, to: string): string[] => ["log", "--oneline", "--no-decorate", "-n", "10", `${from}..${to}`];
const diffArgs = (from: string, to: string): string[] => ["diff", "--name-only", from, to];

export const gitArgs = {
  currentBranch: currentBranchArgs,
  originHead: originHeadArgs,
  headSha: headShaArgs,
  verifyRemote: verifyRemoteArgs,
  status: statusArgs,
  fetch: fetchArgs,
  merge: mergeArgs,
  count: countArgs,
  log: logArgs,
  diff: diffArgs,
};

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function allowed(args: readonly string[]): boolean {
  if (same(args, currentBranchArgs()) || same(args, originHeadArgs()) || same(args, headShaArgs()) || same(args, statusArgs())) return true;
  const b = (i: number, prefix: string) => {
    const name = branchOf(args, i, prefix);
    return safeBranch(name) ? name : null;
  };
  switch (args[0]) {
    case "rev-parse": {
      const name = b(3, "refs/remotes/origin/");
      return name !== null && same(args, verifyRemoteArgs(name));
    }
    case "fetch": {
      const name = b(2, "");
      return name !== null && same(args, fetchArgs(name));
    }
    case "merge": {
      const name = b(2, "origin/");
      return name !== null && same(args, mergeArgs(name));
    }
    case "rev-list": {
      const name = b(3, "HEAD...origin/");
      return name !== null && same(args, countArgs(name));
    }
    case "log": {
      const [from = "", to = "", extra] = (args[5] ?? "").split("..");
      return extra === undefined && safeSha(from) && safeSha(to) && same(args, logArgs(from, to));
    }
    case "diff": {
      const from = args[2] ?? "";
      const to = args[3] ?? "";
      return safeSha(from) && safeSha(to) && same(args, diffArgs(from, to));
    }
    default:
      return false;
  }
}

/** Throws unless `args` is exactly one of the allowed git commands. */
export function assertGit(args: readonly string[]): void {
  if (!allowed(args)) throw new Error(`repo-sync: git ${args.join(" ")} is not allowed`);
}
