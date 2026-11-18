/** prflow configuration: GitHub accounts and the projects each one covers. Pure, no I/O. */

export interface Account {
  /** GitHub login. prflow reads its token with `gh auth token -u <login>`. */
  login: string;
  /** Owners (users or orgs) whose repos this account covers. */
  owners: string[];
  /** Individual `owner/repo` entries this account covers. */
  repos: string[];
}

export interface Config {
  /** Order matters: when two accounts find the same PR, the first one wins. */
  accounts: Account[];
  /** Search result cap per query. */
  limit: number;
  /** Include Orca worktree cleanup candidates. */
  worktrees: boolean;
}

export const DEFAULT_LIMIT = 50;

/** An account with no owners and no repos covers every repo. */
export const isUnscoped = (a: Account): boolean => a.owners.length === 0 && a.repos.length === 0;

const lower = (s: string) => s.toLowerCase();

/**
 * The account that covers `repo` (`owner/repo`, case-insensitive): an exact repo
 * entry first, then an owner entry, then the first unscoped account.
 */
export function accountFor(cfg: Config, repo: string): Account | null {
  const r = lower(repo);
  const owner = r.split("/")[0] ?? "";
  return (
    cfg.accounts.find((a) => a.repos.some((x) => lower(x) === r)) ??
    cfg.accounts.find((a) => a.owners.some((x) => lower(x) === owner)) ??
    cfg.accounts.find(isUnscoped) ??
    null
  );
}

/** GitHub login, org, or repo name: letters, digits, `-`, `_`, `.`. */
const NAME = /^[A-Za-z0-9_.-]+$/;

function strings(v: unknown, where: string): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
    throw new Error(`${where} must be an array of strings`);
  return v as string[];
}

/** Parse and validate a config file. Errors name the file and the bad field. */
export function parseConfig(text: string, source: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`${source}: invalid JSON: ${(e as Error).message}`);
  }
  const fail = (msg: string): never => {
    throw new Error(`${source}: ${msg}`);
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("top level must be an object");
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o))
    if (!["$comment", "accounts", "limit", "worktrees"].includes(k)) fail(`unknown key "${k}"`);
  if (!Array.isArray(o.accounts) || o.accounts.length === 0) fail("accounts must be a non-empty array");
  const accounts = (o.accounts as unknown[]).map((a, i): Account => {
    const where = `accounts[${i}]`;
    if (typeof a !== "object" || a === null) return fail(`${where} must be an object`);
    const r = a as Record<string, unknown>;
    for (const k of Object.keys(r))
      if (!["$comment", "login", "owners", "repos"].includes(k)) fail(`${where}: unknown key "${k}"`);
    if (typeof r.login !== "string" || !NAME.test(r.login)) fail(`${where}.login must be a GitHub login`);
    let repos: string[] = [];
    let owners: string[] = [];
    try {
      owners = strings(r.owners, `${where}.owners`);
      repos = strings(r.repos, `${where}.repos`);
    } catch (e) {
      fail((e as Error).message);
    }
    for (const x of owners) if (!NAME.test(x)) fail(`${where}.owners entry "${x}" must be a GitHub owner`);
    for (const x of repos) {
      const parts = x.split("/");
      if (parts.length !== 2 || !parts.every((p) => NAME.test(p))) fail(`${where}.repos entry "${x}" must be owner/repo`);
    }
    return { login: r.login as string, owners, repos };
  });
  const logins = accounts.map((a) => lower(a.login));
  const dup = logins.find((l, i) => logins.indexOf(l) !== i);
  if (dup) fail(`account "${dup}" is listed twice`);
  const unscoped = accounts.filter(isUnscoped);
  if (unscoped.length > 1) fail("at most one account may have no owners and no repos");
  const claimed = new Map<string, string>();
  for (const a of accounts)
    for (const x of [...a.owners.map((w) => `owner ${lower(w)}`), ...a.repos.map((r) => `repo ${lower(r)}`)]) {
      const prev = claimed.get(x);
      if (prev && prev !== a.login) fail(`${x} is assigned to both ${prev} and ${a.login}`);
      claimed.set(x, a.login);
    }
  if (o.limit !== undefined && (typeof o.limit !== "number" || !Number.isInteger(o.limit) || o.limit < 1 || o.limit > 1000))
    fail("limit must be an integer from 1 to 1000");
  if (o.worktrees !== undefined && typeof o.worktrees !== "boolean") fail("worktrees must be a boolean");
  return {
    accounts,
    limit: (o.limit as number | undefined) ?? DEFAULT_LIMIT,
    worktrees: (o.worktrees as boolean | undefined) ?? true,
  };
}
