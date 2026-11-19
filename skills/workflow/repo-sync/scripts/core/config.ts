/** repo-sync configuration: GitHub accounts by remote owner, and repos whose pulls are reported. Pure, no I/O. */

export interface Account {
  /** GitHub login. Its token comes from `gh auth token -u <login>`, only for HTTPS remotes. */
  login: string;
  owners: string[];
  /** `owner/repo` entries. */
  repos: string[];
}

export interface Config {
  accounts: Account[];
  /** Repos (display name, folder name, or `owner/repo`) whose pulls print their new commits. */
  reportChanges: string[];
}

export const DEFAULT_REPORT_CHANGES = ["tiger-team-sync"];

export const defaultConfig = (): Config => ({ accounts: [], reportChanges: [...DEFAULT_REPORT_CHANGES] });

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PART = /^[A-Za-z0-9._-]+$/;

function strings(v: unknown, where: string, fail: (m: string) => never): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.length > 0)) return fail(`${where} must be an array of strings`);
  return v as string[];
}

/** Parse and validate config JSON. Throws with `source` in the message. */
export function parseConfig(text: string, source: string): Config {
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`);
  };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return fail(`invalid JSON: ${(e as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("must be a JSON object");
  const out = defaultConfig();
  for (const [k, v] of Object.entries(raw)) {
    if (k === "$comment") continue;
    if (k === "reportChanges") out.reportChanges = strings(v, "reportChanges", fail);
    else if (k === "accounts") {
      if (!Array.isArray(v)) fail("accounts must be an array");
      out.accounts = (v as unknown[]).map((a, i) => {
        const where = `accounts[${i}]`;
        if (typeof a !== "object" || a === null || Array.isArray(a)) return fail(`${where} must be an object`);
        const r = a as Record<string, unknown>;
        for (const key of Object.keys(r)) if (!["$comment", "login", "owners", "repos"].includes(key)) fail(`${where}: unknown key "${key}"`);
        if (typeof r.login !== "string" || !NAME.test(r.login)) fail(`${where}.login must be a GitHub login`);
        const owners = strings(r.owners, `${where}.owners`, fail);
        const repos = strings(r.repos, `${where}.repos`, fail);
        for (const o of owners) if (!NAME.test(o)) fail(`${where}.owners entry "${o}" must be a GitHub user or org`);
        for (const repo of repos) {
          const parts = repo.split("/");
          if (parts.length !== 2 || !NAME.test(parts[0] ?? "") || !REPO_PART.test(parts[1] ?? "")) fail(`${where}.repos entry "${repo}" must be owner/repo`);
        }
        return { login: r.login as string, owners, repos };
      });
    } else fail(`unknown key "${k}"`);
  }
  if (out.accounts.filter((a) => !a.owners.length && !a.repos.length).length > 1) fail("at most one account may have no owners or repos");
  return out;
}

/** The account for `owner/repo`: an exact `repos` entry, then an `owners` entry, then the unscoped account. */
export function accountFor(cfg: Config, slug: string | null): Account | null {
  const unscoped = cfg.accounts.find((a) => !a.owners.length && !a.repos.length) ?? null;
  if (!slug) return unscoped;
  const s = slug.toLowerCase();
  const owner = s.split("/")[0] ?? "";
  return (
    cfg.accounts.find((a) => a.repos.some((r) => r.toLowerCase() === s)) ??
    cfg.accounts.find((a) => a.owners.some((o) => o.toLowerCase() === owner)) ??
    unscoped
  );
}

/** Whether a pull in this repo should print its new commits. */
export function reportsChanges(cfg: Config, repo: { name: string; path: string; slug: string | null }): boolean {
  const keys = [repo.name, repo.path.split("/").at(-1) ?? "", repo.slug ?? ""].map((k) => k.toLowerCase());
  return cfg.reportChanges.some((r) => keys.includes(r.toLowerCase()));
}
