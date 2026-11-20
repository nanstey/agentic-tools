/**
 * repo-sync configuration.
 * Accounts come from prflow's config (one source of truth for GitHub accounts);
 * repo-sync's own config only lists repos whose pulls are reported.
 */
import { dirname } from "node:path";
import { configPaths, siblingConfigPaths } from "../../../../lib/paths.ts";
import { accountFor as selectAccount, parseAccounts as parseAccountList } from "../../../../lib/accounts.ts";
import type { Account } from "../../../../lib/accounts.ts";
export type { Account } from "../../../../lib/accounts.ts";
import { readOrNull, type Read } from "./store.ts";

export interface Config {
  accounts: Account[];
  /** Repos (display name, folder name, or `owner/repo`) whose pulls print their new commits. */
  reportChanges: string[];
}

export const DEFAULT_REPORT_CHANGES: string[] = [];

export const defaultConfig = (): Config => ({ accounts: [], reportChanges: [...DEFAULT_REPORT_CHANGES] });

function strings(v: unknown, where: string, fail: (m: string) => never): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.length > 0)) return fail(`${where} must be an array of strings`);
  return v as string[];
}

function parseObject(text: string, fail: (m: string) => never): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return fail(`invalid JSON: ${(e as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("must be a JSON object");
  return raw as Record<string, unknown>;
}

const failer = (source: string) => (msg: string): never => {
  throw new Error(`${source}: ${msg}`);
};

/** Parse repo-sync's own config JSON (`reportChanges` only). Throws with `source` in the message. */
export function parseConfig(text: string, source: string): Config {
  const fail = failer(source);
  const out = defaultConfig();
  for (const [k, v] of Object.entries(parseObject(text, fail))) {
    if (k === "$comment") continue;
    if (k === "reportChanges") out.reportChanges = strings(v, "reportChanges", fail);
    else if (k === "accounts") fail('"accounts" is read from prflow\'s config; remove it here');
    else fail(`unknown key "${k}"`);
  }
  return out;
}

/** Read `accounts` from prflow's config JSON, ignoring its other keys. Throws with `source` in the message. */
export function parseAccounts(text: string, source: string): Account[] {
  const fail = failer(source);
  const v = parseObject(text, fail).accounts;
  if (v === undefined) return [];
  if (!Array.isArray(v)) return fail("accounts must be an array");
  return parseAccountList(v, fail);
}

/** The account for `owner/repo`: an exact `repos` entry, then an `owners` entry, then the unscoped account. */
export function accountFor(cfg: Config, slug: string | null): Account | null {
  return selectAccount(cfg.accounts, slug);
}

/** Whether a pull in this repo should print its new commits. */
export function reportsChanges(cfg: Config, repo: { name: string; path: string; slug: string | null }): boolean {
  const keys = [repo.name, repo.path.split("/").at(-1) ?? "", repo.slug ?? ""].map((k) => k.toLowerCase());
  return cfg.reportChanges.some((r) => keys.includes(r.toLowerCase()));
}

/** Skill directory, where an uncommitted `config.json` may sit beside `config.example.json`. */
export const SKILL_DIR = dirname(import.meta.dirname);

/** repo-sync config files tried in order when no explicit path is given. */
export function defaultPaths(env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  return home === undefined ? configPaths(SKILL_DIR, "repo-sync", env) : configPaths(SKILL_DIR, "repo-sync", env, home);
}

/** prflow config files tried in order, matching prflow's own lookup (after `PRFLOW_CONFIG`). */
export function prflowPaths(env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  return home === undefined ? siblingConfigPaths(SKILL_DIR, "prflow", "prflow", env) : siblingConfigPaths(SKILL_DIR, "prflow", "prflow", env, home);
}

/** First file of an explicit path (must exist) or the first existing default path. */
function firstFile(explicit: string | undefined, paths: string[], read: Read): { text: string; source: string } | null {
  if (explicit) {
    const text = read(explicit);
    if (text === null) throw new Error(`config file not found: ${explicit}`);
    return { text, source: explicit };
  }
  for (const p of paths) {
    const text = read(p);
    if (text !== null) return { text, source: p };
  }
  return null;
}

export interface ConfigSources {
  /** `--config` or `REPO_SYNC_CONFIG`; must exist. */
  explicit?: string | undefined;
  paths: string[];
  /** `PRFLOW_CONFIG`; must exist. */
  prflowExplicit?: string | undefined;
  prflowPaths: string[];
}

/**
 * Resolve the config. `reportChanges` comes from repo-sync's config (explicit,
 * then the first default path, then defaults). `accounts` come from prflow's
 * config, the same file prflow uses; none when prflow has no config.
 */
export function loadConfig(src: ConfigSources, read: Read = readOrNull): { config: Config; source: string; accountsSource: string } {
  const own = firstFile(src.explicit, src.paths, read);
  const config = own ? parseConfig(own.text, own.source) : defaultConfig();
  const prflow = firstFile(src.prflowExplicit, src.prflowPaths, read);
  if (prflow) config.accounts = parseAccounts(prflow.text, prflow.source);
  return { config, source: own?.source ?? "defaults", accountsSource: prflow?.source ?? "none" };
}
