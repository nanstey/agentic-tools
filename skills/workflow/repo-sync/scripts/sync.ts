/** Per-repo fast-forward. All I/O goes through `Deps`; every git call uses a builder from `git.ts`. */
import { accountFor, reportsChanges, type Config } from "./config.ts";
import { baseBranch, parseRemote, transport } from "./repos.ts";
import type { Repo, RepoResult, SkipReason, FailReason } from "./types.ts";
import type { CmdResult, Deps } from "./deps.ts";
import { gitArgs, safeBranch, safeSha } from "./git.ts";

export interface SyncOptions {
  config: Config;
  dryRun: boolean;
  /** Repos processed at once. Output keeps the input order. */
  concurrency?: number;
}

const printable = (s: string) => s.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "?");
const firstLine = (s: string) =>
  printable((s.split("\n").map((l) => l.trim()).find(Boolean) ?? "").replace(/^(fatal|error): /, "").slice(0, 200));

/** The repo has no `origin` remote (as opposed to an unreachable one). */
const NO_REMOTE = /'origin' does not appear to be a git repository|No such remote 'origin'/i;

/** Token lookups, once per login per run. */
type TokenCache = Map<string, Promise<string | null>>;

/** How the fetch authenticates. Only HTTPS remotes with a mapped account get `GH_TOKEN`. */
async function authFor(deps: Deps, remoteUrl: string, cfg: Config, tokens: TokenCache, dryRun: boolean) {
  const kind = transport(remoteUrl);
  if (kind !== "https") return { label: kind === "ssh" ? "ssh" : "local", env: undefined };
  // Only plain https://github.com/<owner>/<repo> gets a token; any other host, scheme, or odd userinfo stays ambient.
  const remote = /^https:\/\/(?:[^/@\\]*@)?github\.com(?::443)?\//i.test(remoteUrl) ? parseRemote(remoteUrl) : null;
  const login = remote && accountFor(cfg, `${remote.owner}/${remote.repo}`)?.login;
  if (!login) return { label: "https (ambient)", env: undefined };
  if (dryRun) return { label: `https as ${login}`, env: undefined };
  let p = tokens.get(login);
  if (!p) tokens.set(login, (p = deps.ghToken(login).catch(() => null)));
  const token = await p;
  return token ? { label: `https as ${login}`, env: { GH_TOKEN: token } } : { label: `https (ambient, no token for ${login})`, env: undefined };
}

/** Sync one main checkout. Never throws for git failures; they become a result. */
export async function syncRepo(deps: Deps, repo: Repo, opts: SyncOptions, tokens: TokenCache = new Map()): Promise<RepoResult> {
  const base: RepoResult = { path: repo.path, name: repo.name, slug: repo.slug, status: "up-to-date", auth: "local" };
  const skip = (reason: SkipReason, detail?: string): RepoResult => ({ ...base, status: "skipped", reason, ...(detail ? { detail } : {}) });
  const failed = (reason: FailReason, detail: string): RepoResult => ({ ...base, status: "failed", reason, detail });
  const git = (args: string[], env?: Record<string, string>): Promise<CmdResult> => deps.git(repo.path, args, env);

  const cur = await git(gitArgs.currentBranch());
  if (!cur.ok) return failed("error", firstLine(cur.stderr) || "not a readable git checkout");
  const current = cur.stdout.trim();
  base.branch = current;

  if (!repo.remoteName) return skip("no-remote");
  if (repo.remoteName !== "origin") return skip("no-remote", `remote is ${repo.remoteName}, not origin`);

  const originUrl = await git(gitArgs.originUrl());
  if (!originUrl.ok) return NO_REMOTE.test(originUrl.stderr) ? skip("no-remote", firstLine(originUrl.stderr)) : failed("error", firstLine(originUrl.stderr));
  const remoteUrl = originUrl.stdout.trim();
  const kind = transport(remoteUrl);
  base.auth = kind === "other" ? "local" : kind;

  const head = await git(gitArgs.originHead());
  const fromOrigin = head.ok ? head.stdout.trim().replace(/^origin\//, "") : "";
  const def = safeBranch(fromOrigin) ? fromOrigin : baseBranch(repo.baseRef);
  if (!def || !safeBranch(def)) return skip("no-default-branch", "no origin/HEAD and no Orca base ref");
  base.defaultBranch = def;

  if (current !== def) return skip("not-on-default", current === "HEAD" ? `detached HEAD, default ${def}` : `on ${current}, default ${def}`);

  const status = await git(gitArgs.status());
  if (!status.ok) return failed("error", firstLine(status.stderr));
  const changed = status.stdout.split("\n").filter(Boolean).length;
  if (changed) return skip("dirty", `${changed} changed path${changed === 1 ? "" : "s"}`);

  const auth = await authFor(deps, remoteUrl, opts.config, tokens, opts.dryRun);
  base.auth = auth.label;
  if (!opts.dryRun) {
    const f = await git(gitArgs.fetch(def), auth.env);
    if (!f.ok) return NO_REMOTE.test(f.stderr) ? skip("no-remote", firstLine(f.stderr)) : skip("fetch-failed", firstLine(f.stderr) || "git fetch failed");
  }

  const count = await git(gitArgs.count(def));
  if (!count.ok) return skip("no-remote", firstLine(count.stderr) || `origin/${def} missing`);
  const [ahead, behind] = count.stdout.trim().split(/\s+/).map(Number);
  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) return failed("error", firstLine(count.stderr) || "cannot compare with origin");
  if (ahead! > 0 && behind! > 0) return skip("diverged", `${ahead} ahead, ${behind} behind origin/${def}`);
  if (ahead! > 0) return skip("ahead", `${ahead} ahead of origin/${def}`);
  if (behind === 0) return base;
  if (opts.dryRun) return { ...base, status: "would-update", commits: behind! };

  // The fetch can take a while: re-check the branch and the working tree right before merging.
  const again = await git(gitArgs.currentBranch());
  if (!again.ok || again.stdout.trim() !== def) return skip("not-on-default", `switched to ${again.stdout.trim() || "unknown"} during sync`);
  const recheck = await git(gitArgs.status());
  if (!recheck.ok) return failed("error", firstLine(recheck.stderr));
  const nowChanged = recheck.stdout.split("\n").filter(Boolean).length;
  if (nowChanged) return skip("dirty", `${nowChanged} changed path${nowChanged === 1 ? "" : "s"} appeared during sync`);

  const from = (await git(gitArgs.headSha())).stdout.trim();
  const m = await git(gitArgs.merge(def));
  if (!m.ok) return failed("merge-failed", firstLine(m.stderr) || "git merge --ff-only failed");
  const to = (await git(gitArgs.headSha())).stdout.trim();
  const out: RepoResult = { ...base, status: "updated", commits: behind!, from, to };

  if (reportsChanges(opts.config, repo) && safeSha(from) && safeSha(to)) {
    const log = await git(gitArgs.log(from, to));
    const diff = await git(gitArgs.diff(from, to));
    out.log = log.ok ? log.stdout.split("\n").filter(Boolean).slice(0, 10).map(printable) : [];
    const paths = diff.ok ? diff.stdout.split("\n").filter(Boolean).map(printable) : [];
    out.paths = paths.slice(0, 15);
    out.totalPaths = paths.length;
  }
  return out;
}

/** Sync every repo with a small worker pool. One repo's failure never stops the others. */
export async function syncAll(deps: Deps, repos: Repo[], opts: SyncOptions): Promise<RepoResult[]> {
  const results: RepoResult[] = new Array(repos.length);
  const tokens: TokenCache = new Map();
  let next = 0;
  const worker = async () => {
    while (next < repos.length) {
      const i = next++;
      const repo = repos[i]!;
      try {
        results[i] = await syncRepo(deps, repo, opts, tokens);
      } catch (e) {
        results[i] = { path: repo.path, name: repo.name, slug: repo.slug, status: "failed", reason: "error", detail: (e as Error).message, auth: "local" };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 4, repos.length) }, worker));
  return results;
}
