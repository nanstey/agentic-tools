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
  /** Safety limits for `prflow tick`. */
  rails: Rails;
  /** Side-effect switches for `prflow tick`. */
  actions: Actions;
  /** Pi session dispatch for `ci`, `comments`, and `behind`. */
  dispatch: DispatchConfig;
  /** Reviewer sessions for `review-requested`. */
  review: ReviewConfig;
}

export interface ReviewConfig {
  /**
   * Announce reviewer sessions without creating a worktree or launching Pi.
   * Defaults to `true`, separate from `dispatch.dryRun` and `actions.dryRun`.
   */
  dryRun: boolean;
  /** Reviewer dispatches open at once. */
  maxConcurrent: number;
  sessionReviews: number;
  idleCloseHours: number;
  statuses: { draft: string; reviewing: string; changes: string; approved: string };
}

export const DEFAULT_REVIEW: ReviewConfig = { dryRun: true, maxConcurrent: 2, sessionReviews: 5, idleCloseHours: 24, statuses: { draft: "review-draft", reviewing: "reviewing", changes: "review-changes", approved: "review-approved" } };

function parseReview(v: unknown, fail: (msg: string) => never): ReviewConfig {
  if (v === undefined) return { ...DEFAULT_REVIEW };
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("review must be an object");
  const out: ReviewConfig = { ...DEFAULT_REVIEW };
  for (const [k, x] of Object.entries(v)) {
    if (k === "$comment") continue;
    if (k === "dryRun") {
      if (typeof x !== "boolean") fail("review.dryRun must be a boolean");
      out.dryRun = x as boolean;
    } else if (k === "maxConcurrent") {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > 20) fail("review.maxConcurrent must be an integer from 1 to 20");
      out.maxConcurrent = x as number;
    } else if (k === "sessionReviews") {
      if (typeof x !== "number" || !Number.isInteger(x) || x < 1) fail("review.sessionReviews must be an integer >= 1");
      out.sessionReviews = x as number;
    } else if (k === "idleCloseHours") {
      if (typeof x !== "number" || !Number.isFinite(x) || x <= 0) fail("review.idleCloseHours must be a number > 0");
      out.idleCloseHours = x as number;
    } else if (k === "statuses") {
      if (typeof x !== "object" || x === null || Array.isArray(x)) fail("review.statuses must be an object");
      const statuses = { ...DEFAULT_REVIEW.statuses };
      for (const [name, id] of Object.entries(x)) {
        if (!(name in statuses)) fail(`review.statuses: unknown key "${name}"`);
        if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) fail(`review.statuses.${name} must match ^[a-z0-9][a-z0-9-]{0,40}$`);
        statuses[name as keyof typeof statuses] = id;
      }
      out.statuses = statuses;
    } else fail(`review: unknown key "${k}"`);
  }
  return out;
}

/** A shared project that some repos' PRs belong to; briefs point agents at it. */
export interface ProjectContext {
  /** Absolute path of the project's checkout (for example a docs repo). */
  path: string;
  /** Folder inside `path` with the project's own docs, or `null`. */
  folder: string | null;
  /** `owner/repo` entries whose PRs belong to this project. */
  repos: string[];
  /** Owners (users or orgs) all of whose repos belong to this project. */
  owners: string[];
}

export interface DispatchConfig {
  /**
   * Announce briefs and targets without launching or messaging any session.
   * Defaults to `true`, separate from `actions.dryRun`; set `false` to dispatch.
   */
  dryRun: boolean;
  projectContext: ProjectContext[];
}

export const DEFAULT_DISPATCH: DispatchConfig = { dryRun: true, projectContext: [] };

function parseDispatch(v: unknown, fail: (msg: string) => never): DispatchConfig {
  if (v === undefined) return { ...DEFAULT_DISPATCH, projectContext: [] };
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("dispatch must be an object");
  const out: DispatchConfig = { ...DEFAULT_DISPATCH, projectContext: [] };
  for (const [k, x] of Object.entries(v)) {
    if (k === "$comment") continue;
    if (k === "dryRun") {
      if (typeof x !== "boolean") fail("dispatch.dryRun must be a boolean");
      out.dryRun = x as boolean;
    } else if (k === "projectContext") {
      if (!Array.isArray(x)) fail("dispatch.projectContext must be an array");
      out.projectContext = (x as unknown[]).map((p, i) => {
        const where = `dispatch.projectContext[${i}]`;
        if (typeof p !== "object" || p === null || Array.isArray(p)) return fail(`${where} must be an object`);
        const r = p as Record<string, unknown>;
        for (const key of Object.keys(r)) if (!["$comment", "path", "folder", "repos", "owners"].includes(key)) fail(`${where}: unknown key "${key}"`);
        if (typeof r.path !== "string" || !r.path.startsWith("/") || /[\n\0]/.test(r.path)) fail(`${where}.path must be an absolute path`);
        if (r.folder !== undefined && (typeof r.folder !== "string" || !/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/.test(r.folder) || r.folder.split("/").includes("..")))
          fail(`${where}.folder must be a relative folder name`);
        let repos: string[] = [];
        let owners: string[] = [];
        try {
          repos = strings(r.repos, `${where}.repos`);
          owners = strings(r.owners, `${where}.owners`);
        } catch (e) {
          fail((e as Error).message);
        }
        for (const o of owners) if (!NAME.test(o)) fail(`${where}.owners entry "${o}" must be a GitHub user or org`);
        if (!repos.length && !owners.length) fail(`${where} needs repos or owners`);
        for (const repo of repos) {
          const parts = repo.split("/");
          if (parts.length !== 2 || !parts.every((q) => NAME.test(q))) fail(`${where}.repos entry "${repo}" must be owner/repo`);
        }
        return { path: r.path as string, folder: (r.folder as string | undefined) ?? null, repos, owners };
      });
    } else fail(`dispatch: unknown key "${k}"`);
  }
  return out;
}

/** The project a repo's PRs belong to, if any (case-insensitive). */
/** The project of `repo`: an exact repo entry first, then an owner entry. */
export function projectFor(d: DispatchConfig, repo: string): ProjectContext | null {
  const r = repo.toLowerCase();
  const owner = r.split("/")[0] ?? "";
  return d.projectContext.find((p) => p.repos.some((x) => x.toLowerCase() === r)) ?? d.projectContext.find((p) => p.owners.some((x) => x.toLowerCase() === owner)) ?? null;
}

export interface Actions {
  /** Announce actions without running them. Defaults to `true`; set `false` to act. */
  dryRun: boolean;
}

export const DEFAULT_ACTIONS: Actions = { dryRun: true };

function parseActions(v: unknown, fail: (msg: string) => never): Actions {
  if (v === undefined) return { ...DEFAULT_ACTIONS };
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("actions must be an object");
  const out: Actions = { ...DEFAULT_ACTIONS };
  for (const [k, x] of Object.entries(v)) {
    if (k === "$comment") continue;
    if (k !== "dryRun") fail(`actions: unknown key "${k}"`);
    if (typeof x !== "boolean") fail("actions.dryRun must be a boolean");
    out.dryRun = x as boolean;
  }
  return out;
}

export const DEFAULT_LIMIT = 50;

/** Safety limits for `prflow tick`. Every field has a conservative default. */
export interface Rails {
  /** Dispatch starts allowed in one tick. */
  startsPerTick: number;
  /** Dispatches open (planned, launched, working) at once. */
  maxOpen: number;
  /** Dispatch starts per rolling hour. */
  perHour: number;
  /** Dispatch starts per rolling 24 hours. */
  perDay: number;
  /** Starts for one item and version in 24 hours that pause the item. */
  loopSameVersion: number;
  /** Starts for one item across versions in 24 hours that pause the item. */
  loopAcrossVersions: number;
  /** Delay after the first failed tick; doubles per further failure. */
  backoffBaseMinutes: number;
  backoffMaxMinutes: number;
  /** Time allowed for the scan of one tick. */
  pollBudgetSeconds: number;
  /** Time allowed for one child process (gh, git, orca-ide). */
  childTimeoutSeconds: number;
  /** Lease a launched dispatch holds before it counts as stale. */
  leaseMinutes: number;
  /** Starts of one dispatch (item, version, kind) before it is abandoned. */
  maxAttempts: number;
  /** Reruns of one item version's cancelled checks; then the item is paused. */
  rerunsPerVersion: number;
  /**
   * How long a busy Pi session may hold up a brief: a session busy in the
   * worktree before delivery, or the briefed session still busy after it.
   * Then prflow interrupts it and restarts it with the brief.
   */
  busyWaitMinutes: number;
}

export const DEFAULT_RAILS: Rails = {
  startsPerTick: 2,
  maxOpen: 5,
  perHour: 6,
  perDay: 30,
  loopSameVersion: 3,
  loopAcrossVersions: 8,
  backoffBaseMinutes: 15,
  backoffMaxMinutes: 240,
  pollBudgetSeconds: 120,
  childTimeoutSeconds: 60,
  leaseMinutes: 45,
  maxAttempts: 3,
  rerunsPerVersion: 2,
  busyWaitMinutes: 45,
};

/** Validate a `rails` object: known keys only, positive integers. Missing keys use defaults. */
function parseRails(v: unknown, fail: (msg: string) => never): Rails {
  if (v === undefined) return { ...DEFAULT_RAILS };
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fail("rails must be an object");
  const out: Rails = { ...DEFAULT_RAILS };
  for (const [k, x] of Object.entries(v)) {
    if (k === "$comment") continue;
    if (!(k in DEFAULT_RAILS)) fail(`rails: unknown key "${k}"`);
    if (typeof x !== "number" || !Number.isInteger(x) || x < 1 || x > 100000)
      fail(`rails.${k} must be an integer from 1 to 100000`);
    out[k as keyof Rails] = x as number;
  }
  return out;
}

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
    if (!["$comment", "accounts", "limit", "worktrees", "rails", "actions", "dispatch", "review"].includes(k)) fail(`unknown key "${k}"`);
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
    rails: parseRails(o.rails, fail),
    actions: parseActions(o.actions, fail),
    dispatch: parseDispatch(o.dispatch, fail),
    review: parseReview(o.review, fail),
  };
}
