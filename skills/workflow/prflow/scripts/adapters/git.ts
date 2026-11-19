/**
 * Allowed Git writes: guarded review fetch/reset on clean review worktrees and
 * local branch deletion after safe archival. `git update-ref -d <ref> <sha>`
 * deletes the ref only while it still points at the checked commit.
 */
export const reviewFetchArgs = (path: string, pr: number): string[] => ["-C", path, "fetch", "origin", `pull/${pr}/head`];
export const reviewResetArgs = (path: string, sha: string): string[] => ["-C", path, "reset", "--hard", sha];

function safeAbs(path: string): boolean { return path.startsWith("/") && !path.split("/").includes("..") && !/[\n\0]/.test(path); }
export function assertReviewFetch(args: readonly string[]): void {
  const ok = args.length === 5 && args[0] === "-C" && safeAbs(args[1] ?? "") && (args[1]?.split("/").at(-1)?.startsWith("prflow-review-") ?? false) && args[2] === "fetch" && args[3] === "origin" && /^pull\/[1-9]\d*\/head$/.test(args[4] ?? "");
  if (!ok) throw new Error(`prflow: git ${args.join(" ")} is not the allowed review fetch`);
}
export function assertReviewReset(args: readonly string[]): void {
  const ok = args.length === 5 && args[0] === "-C" && safeAbs(args[1] ?? "") && (args[1]?.split("/").at(-1)?.startsWith("prflow-review-") ?? false) && args[2] === "reset" && args[3] === "--hard" && /^[0-9a-f]{40}$/.test(args[4] ?? "");
  if (!ok) throw new Error(`prflow: git ${args.join(" ")} is not the allowed review reset`);
}

export const deleteBranchArgs = (gitDir: string, branch: string, sha: string): string[] => [
  "--git-dir",
  gitDir,
  "update-ref",
  "-d",
  `refs/heads/${branch}`,
  sha,
];

/** A plain branch name: no option prefix, no `..`, no control or glob characters. */
export function safeBranch(b: string): boolean {
  return (
    /^[A-Za-z0-9._/-]+$/.test(b) &&
    !b.startsWith("-") &&
    !b.startsWith("/") &&
    !b.endsWith("/") &&
    !b.endsWith(".lock") &&
    !b.includes("..") &&
    !b.includes("//")
  );
}

/** Throws unless `args` is exactly `--git-dir <absolute path> update-ref -d refs/heads/<branch> <40-hex sha>`. */
export function assertDeleteBranch(args: readonly string[]): void {
  const dir = args[1] ?? "";
  const ref = args[4] ?? "";
  const ok =
    args.length === 6 &&
    args[0] === "--git-dir" &&
    dir.startsWith("/") &&
    !dir.split("/").includes("..") &&
    !/[\n\0]/.test(dir) &&
    args[2] === "update-ref" &&
    args[3] === "-d" &&
    ref.startsWith("refs/heads/") &&
    safeBranch(ref.slice("refs/heads/".length)) &&
    /^[0-9a-f]{40}$/.test(args[5] ?? "");
  if (!ok) throw new Error(`prflow: git ${args.join(" ")} is not the allowed branch deletion`);
}
