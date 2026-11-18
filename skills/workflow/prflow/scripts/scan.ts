import { classify, classifyWorktree } from "./core/classify.ts";
import { accountFor, type Account, type Config } from "./core/config.ts";
import type { Classification, PrSnapshot, Role, WorktreeItem } from "./core/types.ts";
import { parsePr, parsePrRefs, parseSearch, prArgs, type SearchHit } from "./adapters/gh.ts";
import { parseWorktrees, repoFromPrUrl } from "./adapters/orca.ts";

export interface CmdResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** All I/O the scanner needs. Real implementations live in `deps.ts`; tests fake them. */
export interface Deps {
  /** Run a read-only `gh` command as GitHub account `login`. */
  gh(login: string, args: string[]): Promise<CmdResult>;
  /** `orca worktree list --json` output. */
  orcaWorktrees(): Promise<string>;
  /** Uncommitted file count in a worktree, `null` when unknown. */
  gitDirty(path: string): Promise<number | null>;
}

export interface ScanResult {
  prs: PrSnapshot[];
  worktrees: WorktreeItem[];
  errors: string[];
}

/** Search scopes for one account: owners and repos are separate queries; none means unscoped. */
export function scopes(a: Account): string[][] {
  if (a.owners.length === 0 && a.repos.length === 0) return [[]];
  const out: string[][] = [];
  if (a.owners.length) out.push(a.owners.flatMap((o) => ["--owner", o]));
  if (a.repos.length) out.push(a.repos.flatMap((r) => ["--repo", r]));
  return out;
}

async function search(deps: Deps, login: string, args: string[], errors: string[]): Promise<SearchHit[]> {
  const r = await deps.gh(login, args);
  if (!r.ok) {
    errors.push(`${login}: gh ${args.slice(0, 4).join(" ")}: ${r.stderr.trim()}`);
    return [];
  }
  return parseSearch(r.stdout);
}

interface Job {
  hit: SearchHit;
  role: Role;
  account: string;
}

async function searchAccount(deps: Deps, cfg: Config, a: Account, errors: string[]): Promise<Job[]> {
  const base = ["--state", "open", "--limit", String(cfg.limit), "--json", "number,repository"];
  const runs = scopes(a).flatMap((scope) => [
    { role: "author" as const, args: ["search", "prs", "--author", a.login, "--draft=false", ...base, ...scope] },
    { role: "reviewer" as const, args: ["search", "prs", "--review-requested", a.login, ...base, ...scope] },
  ]);
  const results = await Promise.all(runs.map((r) => search(deps, a.login, r.args, errors)));
  // A repo belongs to exactly one account; drop hits in repos another account covers.
  const mine = (repo: string) => accountFor(cfg, repo)?.login === a.login;
  return runs.flatMap((r, i) =>
    (results[i] ?? []).filter((hit) => mine(hit.repo)).map((hit) => ({ hit, role: r.role, account: a.login })),
  );
}

async function fetchPr(deps: Deps, j: Job, errors: string[]): Promise<PrSnapshot | null> {
  const r = await deps.gh(j.account, prArgs(j.hit.repo, j.hit.number));
  if (!r.ok) {
    errors.push(`${j.account}: ${j.hit.repo}#${j.hit.number}: ${r.stderr.trim()}`);
    return null;
  }
  return parsePr(r.stdout, j.hit.repo, j.hit.number, j.role, j.account);
}

async function scanWorktrees(deps: Deps, cfg: Config, errors: string[]): Promise<WorktreeItem[]> {
  let rows;
  try {
    rows = parseWorktrees(await deps.orcaWorktrees(), []);
  } catch (e) {
    errors.push(`orca worktree list: ${(e as Error).message}`);
    return [];
  }
  const out = await Promise.all(
    rows.map(async (w): Promise<WorktreeItem | null> => {
      const account = accountFor(cfg, w.repo);
      if (!account) return null;
      const fields = ["--json", "number,state,title,url"];
      const args =
        w.linkedPr !== null
          ? ["pr", "view", String(w.linkedPr), "-R", w.repo, ...fields]
          : ["pr", "list", "-R", w.repo, "--head", w.branch, "--state", "all", "--limit", "10", ...fields];
      const r = await deps.gh(account.login, args);
      if (!r.ok) {
        errors.push(`${account.login}: ${w.repo} ${w.branch}: ${r.stderr.trim()}`);
        return null;
      }
      const refs = parsePrRefs(r.stdout);
      if (refs.length === 0 || refs.some((p) => p.state === "OPEN")) return null;
      const pr = refs.reduce((a, b) => (b.number > a.number ? b : a));
      return {
        path: w.path,
        branch: w.branch,
        repo: repoFromPrUrl(pr.url) ?? w.repo,
        account: account.login,
        pr,
        dirtyFiles: await deps.gitDirty(w.path),
      };
    }),
  );
  return out.filter((w): w is WorktreeItem => w !== null);
}

/**
 * Read-only scan for every configured account: its open non-draft PRs and review
 * requests within its scope, plus Orca worktrees of closed PRs in covered repos.
 * A PR found by several searches is fetched once; the first account and the
 * author role win.
 */
export async function scan(deps: Deps, cfg: Config): Promise<ScanResult> {
  const errors: string[] = [];
  const [found, worktrees] = await Promise.all([
    Promise.all(cfg.accounts.map((a) => searchAccount(deps, cfg, a, errors))),
    cfg.worktrees ? scanWorktrees(deps, cfg, errors) : Promise.resolve([]),
  ]);
  const all = found.flat();
  const ordered = [...all.filter((j) => j.role === "author"), ...all.filter((j) => j.role === "reviewer")];
  const seen = new Set<string>();
  const jobs = ordered.filter((j) => {
    const k = `${j.hit.repo}#${j.hit.number}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const prs = await Promise.all(jobs.map((j) => fetchPr(deps, j, errors)));
  return { prs: prs.filter((p): p is PrSnapshot => p !== null), worktrees, errors };
}

export function plan(result: ScanResult): Classification[] {
  const items = result.prs.map((p) => classify(p, p.account));
  for (const w of result.worktrees) {
    const c = classifyWorktree(w);
    if (c) items.push(c);
  }
  return items;
}
