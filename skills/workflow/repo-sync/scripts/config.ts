import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { defaultConfig, parseAccounts, parseConfig, type Config } from "./core/config.ts";

/** Skill directory, where an uncommitted `config.json` may sit beside `config.example.json`. */
export const SKILL_DIR = dirname(import.meta.dirname);

/** repo-sync config files tried in order when no explicit path is given. */
export function defaultPaths(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  return [join(SKILL_DIR, "config.json"), join(xdg, "repo-sync", "config.json")];
}

/** prflow config files tried in order, matching prflow's own lookup (after `PRFLOW_CONFIG`). */
export function prflowPaths(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  return [join(dirname(SKILL_DIR), "prflow", "config.json"), join(xdg, "prflow", "config.json")];
}

type Read = (path: string) => string | null;

const readOrNull: Read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
};

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
