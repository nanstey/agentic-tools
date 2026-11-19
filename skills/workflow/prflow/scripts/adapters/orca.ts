/** Parsing for `orca-ide worktree list --json` (read-only). */

export interface OrcaWorktree {
  path: string;
  /** Branch without `refs/heads/`. */
  branch: string;
  /** `owner/repo`, lowercased, from the Orca project id. */
  repo: string;
  linkedPr: number | null;
}

interface RawWorktree {
  path: string;
  branch?: string | null;
  projectId?: string;
  isMainWorktree?: boolean;
  isArchived?: boolean;
  isBare?: boolean;
  linkedPR?: number | null;
}

/** Repo from an Orca project id such as `github:github.com-alt/acme/widgets`. */
export function repoFromProjectId(id: string): string | null {
  const m = /^github:(.+)$/.exec(id);
  if (!m?.[1]) return null;
  const parts = m[1].split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(-2).join("/").toLowerCase();
}

/** Active, non-main GitHub worktrees whose repo owner is in `owners` (case-insensitive). */
export function parseWorktrees(json: string, owners: readonly string[]): OrcaWorktree[] {
  const out = JSON.parse(json) as { result?: { worktrees?: RawWorktree[] } };
  const want = owners.map((o) => o.toLowerCase());
  const rows: OrcaWorktree[] = [];
  for (const w of out.result?.worktrees ?? []) {
    if (w.isMainWorktree || w.isArchived || w.isBare || !w.projectId || !w.branch) continue;
    const repo = repoFromProjectId(w.projectId);
    if (!repo || (want.length > 0 && !want.includes(repo.split("/")[0] ?? ""))) continue;
    rows.push({
      path: w.path,
      branch: w.branch.replace(/^refs\/heads\//, ""),
      repo,
      linkedPr: typeof w.linkedPR === "number" ? w.linkedPR : null,
    });
  }
  return rows;
}

/** `owner/repo` with GitHub's casing, from a PR URL. */
export function repoFromPrUrl(url: string): string | null {
  const m = /github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  return m?.[1] ?? null;
}

/**
 * The one Orca write prflow makes: remove (archive) a Git worktree by path. Orca
 * keeps the branch by default. Never `--force`, never `--delete-branch`.
 */
export const archiveArgs = (path: string): string[] => ["worktree", "rm", "--worktree", `path:${path}`, "--json"];

/** Throws unless `args` is exactly `worktree rm --worktree path:<absolute path> --json`. */
export function assertArchive(args: readonly string[]): void {
  const sel = args[3] ?? "";
  const path = sel.slice("path:".length);
  const ok =
    args.length === 5 &&
    args[0] === "worktree" &&
    args[1] === "rm" &&
    args[2] === "--worktree" &&
    sel.startsWith("path:/") &&
    !path.split("/").includes("..") &&
    !/[\n\0]/.test(path) &&
    args[4] === "--json";
  if (!ok) throw new Error(`prflow: orca-ide ${args.join(" ")} is not the allowed archive call`);
}
