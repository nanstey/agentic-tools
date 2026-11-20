/** repo-sync configuration, read from the shared agentic-tools config file. */
import { configPaths as sharedConfigPaths, parseSharedConfig, toolSection } from "../../../../lib/config.ts";
import { accountFor as selectAccount } from "../../../../lib/accounts.ts";
import type { Account } from "../../../../lib/accounts.ts";
export type { Account } from "../../../../lib/accounts.ts";
import { readOrNull, type Read } from "./store.ts";

export interface Config {
  accounts: Account[];
  /** Repos (display name, folder name, or `owner/repo`) whose pulls print their new commits. */
  reportChanges: string[];
  /** Repos (display name, folder name, or `owner/repo`) that are never fetched, merged, or reported. */
  ignore: string[];
}

export const DEFAULT_REPORT_CHANGES: string[] = [];
export const defaultConfig = (): Config => ({ accounts: [], reportChanges: [...DEFAULT_REPORT_CHANGES], ignore: [] });

function strings(v: unknown, where: string, fail: (m: string) => never): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.length > 0)) return fail(`${where} must be an array of strings`);
  return v as string[];
}

const failer = (source: string) => (msg: string): never => { throw new Error(`${source}: repoSync.${msg}`); };

export function parseConfig(text: string, source: string): Config {
  const shared = parseSharedConfig(text, source);
  const fail = failer(source);
  const section = toolSection(shared, "repoSync", source);
  const out = defaultConfig();
  for (const [key, value] of Object.entries(section)) {
    if (key === "$comment") continue;
    if (key === "reportChanges") out.reportChanges = strings(value, "reportChanges", fail);
    else if (key === "ignore") out.ignore = strings(value, "ignore", fail);
    else fail(`unknown key "${key}"`);
  }
  out.accounts = shared.accounts;
  return out;
}

/** The account for `owner/repo`: an exact `repos` entry, then an `owners` entry, then the unscoped account. */
export function accountFor(cfg: Config, slug: string | null): Account | null {
  return selectAccount(cfg.accounts, slug);
}

type RepoKeys = { name: string; path: string; slug: string | null };

/** Whether `list` names the repo by display name, folder name, or `owner/repo` (case-insensitive). */
function listed(list: string[], repo: RepoKeys): boolean {
  const keys = [repo.name, repo.path.split("/").at(-1) ?? "", repo.slug ?? ""].map((k) => k.toLowerCase());
  return list.some((r) => keys.includes(r.toLowerCase()));
}

/** Whether a pull in this repo should print its new commits. */
export function reportsChanges(cfg: Config, repo: RepoKeys): boolean {
  return listed(cfg.reportChanges, repo);
}

/** Whether repo-sync must leave this repo alone: no fetch, no merge, no report. */
export function isIgnored(cfg: Config, repo: RepoKeys): boolean {
  return listed(cfg.ignore, repo);
}

export function defaultPaths(env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  return home === undefined ? sharedConfigPaths(env) : sharedConfigPaths(env, home);
}

export interface ConfigSources { explicit?: string | undefined; paths: string[]; }

export function loadConfig(src: ConfigSources, read: Read = readOrNull): { config: Config; source: string } {
  if (src.explicit) {
    const text = read(src.explicit);
    if (text === null) throw new Error(`config file not found: ${src.explicit}`);
    return { config: parseConfig(text, src.explicit), source: src.explicit };
  }
  for (const path of src.paths) {
    const text = read(path);
    if (text !== null) return { config: parseConfig(text, path), source: path };
  }
  return { config: defaultConfig(), source: "defaults" };
}
