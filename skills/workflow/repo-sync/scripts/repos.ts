/** Parse `orca-ide repo list --json` and remote URLs. Pure, no I/O. */
import type { Repo } from "./types.ts";

export interface Remote {
  host: string;
  owner: string;
  repo: string;
}

/**
 * Parse a git remote URL: scp-like `git@host:owner/repo.git` (host may be an SSH
 * alias such as `github.com-work`), `ssh://`, `https://`, `http://`, or `git://`.
 */
export function parseRemote(url: string | null | undefined): Remote | null {
  if (!url) return null;
  let host: string;
  let path: string;
  const scp = /^(?:[^@/]+@)?([^:/]+):(?!\/)(.+)$/.exec(url);
  if (scp && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    host = scp[1] ?? "";
    path = scp[2] ?? "";
  } else {
    try {
      const u = new URL(url);
      if (!["ssh:", "https:", "http:", "git:"].includes(u.protocol)) return null;
      host = u.hostname;
      path = u.pathname.replace(/^\/+/, "");
    } catch {
      return null;
    }
  }
  const parts = path.replace(/\/+$/, "").replace(/\.git$/, "").split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { host, owner: parts[0], repo: parts[1] };
}

/** `ssh` or `https`, from the remote URL. */
export function transport(url: string | null): "ssh" | "https" | "other" {
  if (!url) return "other";
  if (/^https?:\/\//i.test(url)) return "https";
  if (/^ssh:\/\//i.test(url) || /^(?:[^@/]+@)?[^:/]+:(?!\/)/.test(url)) return "ssh";
  return "other";
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Local git repos from Orca's repo list. Folder workspaces, hidden repos, and
 * repos on another execution host are left out. Throws on malformed JSON.
 */
export function parseRepoList(text: string): Repo[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`orca-ide repo list: invalid JSON: ${(e as Error).message}`);
  }
  const repos = (raw as { result?: { repos?: unknown } } | null)?.result?.repos;
  if (!Array.isArray(repos)) throw new Error("orca-ide repo list: missing result.repos");
  const out: Repo[] = [];
  for (const r of repos as Record<string, unknown>[]) {
    if (typeof r !== "object" || r === null) continue;
    const path = str(r.path);
    if (r.kind !== "git" || !path || !path.startsWith("/")) continue;
    if (r.hiddenAt != null || r.hidden === true) continue;
    if (r.executionHostId != null && r.executionHostId !== "local") continue;
    const identity = (typeof r.gitRemoteIdentity === "object" && r.gitRemoteIdentity) as Record<string, unknown> | false;
    const remoteUrl = identity ? str(identity.remoteUrl) : null;
    const remote = parseRemote(remoteUrl);
    out.push({
      id: str(r.id) ?? path,
      path,
      name: str(r.displayName) ?? path.split("/").at(-1) ?? path,
      slug: remote ? `${remote.owner}/${remote.repo}` : null,
      remoteName: identity ? str(identity.remoteName) : null,
      remoteUrl,
      baseRef: str(r.worktreeBaseRef),
    });
  }
  return out;
}

/** Branch name from an Orca base ref such as `origin/main` or `refs/remotes/origin/main`. */
export function baseBranch(ref: string | null): string | null {
  if (!ref) return null;
  const b = ref.replace(/^refs\/remotes\//, "").replace(/^origin\//, "").replace(/^refs\/heads\//, "");
  return b || null;
}
