import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { defaultConfig, parseConfig, type Config } from "./core/config.ts";

/** Skill directory, where an uncommitted `config.json` may sit beside `config.example.json`. */
export const SKILL_DIR = dirname(import.meta.dirname);

/** Config files tried in order when no explicit path is given. */
export function defaultPaths(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
  const xdg = env.XDG_CONFIG_HOME || join(home, ".config");
  return [join(SKILL_DIR, "config.json"), join(xdg, "repo-sync", "config.json")];
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
 * Resolve the config: an explicit file (`--config` or `REPO_SYNC_CONFIG`, must
 * exist), then the first default path that exists, then defaults (no accounts).
 */
export function loadConfig(explicit: string | undefined, paths: string[], read: Read = readOrNull): { config: Config; source: string } {
  if (explicit) {
    const text = read(explicit);
    if (text === null) throw new Error(`config file not found: ${explicit}`);
    return { config: parseConfig(text, explicit), source: explicit };
  }
  for (const p of paths) {
    const text = read(p);
    if (text !== null) return { config: parseConfig(text, p), source: p };
  }
  return { config: defaultConfig(), source: "defaults" };
}
