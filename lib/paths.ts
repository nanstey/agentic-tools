import { join } from "node:path";
import { defaultConfigDir } from "./runtime.ts";

/** Skill-local config, then the named XDG config directory. */
export function configPaths(skillDir: string, name: string, env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  const xdg = home === undefined ? defaultConfigDir(env) : defaultConfigDir(env, home);
  return [join(skillDir, "config.json"), join(xdg, name, "config.json")];
}

/** Config files for a sibling skill, then the named XDG config directory. */
export function siblingConfigPaths(skillDir: string, sibling: string, name: string, env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  const xdg = home === undefined ? defaultConfigDir(env) : defaultConfigDir(env, home);
  return [join(skillDir, "..", sibling, "config.json"), join(xdg, name, "config.json")];
}
