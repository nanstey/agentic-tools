/**
 * The one git write prflow makes: delete the local branch of a merged PR after
 * its worktree is archived. `git update-ref -d <ref> <sha>` deletes the ref only
 * while it still points at the commit prflow checked, so a branch that moved
 * since the check is kept.
 */
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
