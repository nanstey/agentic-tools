import { homedir } from "node:os";
import { dirname } from "node:path";
import { configPaths as sharedConfigPaths } from "../../../../lib/config.ts";

import { readOrNull } from "../../../../lib/runtime.ts";
import type { Read } from "../../../../lib/runtime.ts";
import { DEFAULT_ACTIONS, DEFAULT_DISPATCH, DEFAULT_LIMIT, DEFAULT_RAILS, DEFAULT_REVIEW, DEFAULT_STATUSES, DEFAULT_WORKTREE_STATUS, parseConfig, type Config } from "./core/config.ts";

export const SKILL_DIR = dirname(import.meta.dirname);

export interface ConfigFlags {
  /** Explicit config file (`--config` or `AGENTIC_TOOLS_CONFIG`); must exist. */
  config?: string;
  /** Single-account override (`--user`); ignores config files. */
  user?: string;
  owners?: string[];
  repos?: string[];
}

/** Config files tried in order when no explicit path is given. */
export function defaultPaths(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  return sharedConfigPaths(env, home);
}

export interface Loaded {
  config: Config;
  /** File the config came from, or a description of the fallback. */
  source: string;
}

/** Resolve the config. `--user` and scoped flags keep their existing precedence and fallback. */
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
      taskStatuses: { ...DEFAULT_STATUSES },
      worktreeStatus: { ...DEFAULT_WORKTREE_STATUS, ignore: [] },
      reviewBots: [],
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
    for (const path of paths) {
      const text = read(path);
      if (text !== null) return { config: parseConfig(text, path), source: path };
    }
  return fromFlags(await whoami(), "active gh account");
}
