import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_ACTIONS, DEFAULT_DISPATCH, DEFAULT_LIMIT, DEFAULT_RAILS, DEFAULT_REVIEW, parseConfig, type Config } from "./core/config.ts";

/** Skill directory, where an uncommitted `config.json` may sit beside `config.example.json`. */
export const SKILL_DIR = dirname(import.meta.dirname);

export interface ConfigFlags {
  /** Explicit config file (`--config` or `PRFLOW_CONFIG`); must exist. */
  config?: string;
  /** Single-account override (`--user`); ignores config files. */
  user?: string;
  owners?: string[];
  repos?: string[];
}

/** Config files tried in order when no explicit path is given. */
export function defaultPaths(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  return [join(SKILL_DIR, "config.json"), join(xdg, "prflow", "config.json")];
}

export interface Loaded {
  config: Config;
  /** File the config came from, or a description of the fallback. */
  source: string;
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

/**
 * Resolve the config. Precedence: `--user` (one account, built from flags), then an
 * explicit file, then the first default path that exists, then the active gh account
 * (`whoami`) with flag scope.
 */
export async function loadConfig(
  flags: ConfigFlags,
  whoami: () => Promise<string>,
  read: Read = readOrNull,
  paths: string[] = defaultPaths(),
): Promise<Loaded> {
  const fromFlags = (login: string, source: string): Loaded => ({
    config: {
      accounts: [{ login, owners: flags.owners ?? [], repos: flags.repos ?? [] }],
      limit: DEFAULT_LIMIT,
      worktrees: true,
      rails: { ...DEFAULT_RAILS },
      actions: { ...DEFAULT_ACTIONS },
      dispatch: { ...DEFAULT_DISPATCH, projectContext: [] },
      review: { ...DEFAULT_REVIEW },
    },
    source,
  });
  if (flags.user) return fromFlags(flags.user, "--user");
  if (flags.config) {
    const text = read(flags.config);
    if (text === null) throw new Error(`config file not found: ${flags.config}`);
    return { config: parseConfig(text, flags.config), source: flags.config };
  }
  if (!flags.owners && !flags.repos)
    for (const p of paths) {
      const text = read(p);
      if (text !== null) return { config: parseConfig(text, p), source: p };
    }
  return fromFlags(await whoami(), "active gh account");
}
