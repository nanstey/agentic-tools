import { classify, classifyWorktree } from "./core/classify.ts";
import type { Classification, PrSnapshot, Role, WorktreeItem } from "./core/types.ts";
import { parsePr, parsePrRefs, parseSearch, prArgs, type SearchHit } from "./adapters/gh.ts";
import { parseWorktrees, repoFromPrUrl } from "./adapters/orca.ts";

export interface Config {
  /** GitHub login prflow acts for. */
  me: string;
  /** Owners in scope. Empty means every owner (legacy precheck behavior). */
  owners: string[];
  limit: number;
  /** Include Orca worktree cleanup candidates. */
  worktrees: boolean;
}

export const DEFAULT_CONFIG: Config = { me: "noelcf", owners: ["Checkfront"], limit: 50, worktrees: true };

export interface CmdResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** All I/O the scanner needs. Real implementations live in `deps.ts`; tests fake them. */
export interface Deps {
  /** Run a read-only `gh` command as `me`. */
  gh(args: string[]): Promise<CmdResult>;
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

function ownerArgs(cfg: Config): string[] {
  return cfg.owners.flatMap((o) => ["--owner", o]);
}

async function search(deps: Deps, args: string[], errors: string[]): Promise<SearchHit[]> {
  const r = await deps.gh(args);
  if (!r.ok) {
    errors.push(`gh ${args.slice(0, 4).join(" ")}: ${r.stderr.trim()}`);
    return [];
  }
  return parseSearch(r.stdout);
}

async function fetchPr(deps: Deps, hit: SearchHit, role: Role, errors: string[]): Promise<PrSnapshot | null> {
  const r = await deps.gh(prArgs(hit.repo, hit.number));
  if (!r.ok) {
    errors.push(`${hit.repo}#${hit.number}: ${r.stderr.trim()}`);
    return null;
  }
  return parsePr(r.stdout, hit.repo, hit.number, role);
}

async function scanWorktrees(deps: Deps, cfg: Config, errors: string[]): Promise<WorktreeItem[]> {
  let rows;
  try {
    rows = parseWorktrees(await deps.orcaWorktrees(), cfg.owners);
  } catch (e) {
    errors.push(`orca worktree list: ${(e as Error).message}`);
    return [];
  }
  const out = await Promise.all(
    rows.map(async (w): Promise<WorktreeItem | null> => {
      const fields = ["--json", "number,state,title,url"];
      const args =
        w.linkedPr !== null
          ? ["pr", "view", String(w.linkedPr), "-R", w.repo, ...fields]
          : ["pr", "list", "-R", w.repo, "--head", w.branch, "--state", "all", "--limit", "10", ...fields];
      const r = await deps.gh(args);
      if (!r.ok) {
        errors.push(`${w.repo} ${w.branch}: ${r.stderr.trim()}`);
        return null;
      }
      const refs = parsePrRefs(r.stdout);
      if (refs.length === 0 || refs.some((p) => p.state === "OPEN")) return null;
      const pr = refs.reduce((a, b) => (b.number > a.number ? b : a));
      return {
        path: w.path,
        branch: w.branch,
        repo: repoFromPrUrl(pr.url) ?? w.repo,
        pr,
        dirtyFiles: await deps.gitDirty(w.path),
      };
    }),
  );
  return out.filter((w): w is WorktreeItem => w !== null);
}

/** Read-only scan: own open non-draft PRs, review requests, and worktrees of closed PRs. */
export async function scan(deps: Deps, cfg: Config): Promise<ScanResult> {
  const errors: string[] = [];
  const common = ["--state", "open", "--limit", String(cfg.limit), "--json", "number,repository", ...ownerArgs(cfg)];
  const [own, asked] = await Promise.all([
    search(deps, ["search", "prs", "--author", cfg.me, "--draft=false", ...common], errors),
    search(deps, ["search", "prs", "--review-requested", cfg.me, ...common], errors),
  ]);
  const seen = new Set<string>();
  const jobs: [SearchHit, Role][] = [];
  for (const [hits, role] of [[own, "author"], [asked, "reviewer"]] as const)
    for (const h of hits) {
      const k = `${h.repo}#${h.number}`;
      if (seen.has(k)) continue;
      seen.add(k);
      jobs.push([h, role]);
    }
  const [prs, worktrees] = await Promise.all([
    Promise.all(jobs.map(([h, role]) => fetchPr(deps, h, role, errors))),
    cfg.worktrees ? scanWorktrees(deps, cfg, errors) : Promise.resolve([]),
  ]);
  return { prs: prs.filter((p): p is PrSnapshot => p !== null), worktrees, errors };
}

export function plan(result: ScanResult, cfg: Config): Classification[] {
  const items = result.prs.map((p) => classify(p, cfg.me));
  for (const w of result.worktrees) {
    const c = classifyWorktree(w);
    if (c) items.push(c);
  }
  return items;
}
