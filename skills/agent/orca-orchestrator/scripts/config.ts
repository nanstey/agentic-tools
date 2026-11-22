#!/usr/bin/env node
/**
 * orca-orchestrator configuration, read from the `orchestrator` section of the shared
 * agentic-tools config file. Run directly to print the effective settings as JSON:
 *
 *   node config.ts [--config <path>]
 */
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { configPaths, parseSharedConfig, toolSection } from "../../../../lib/config.ts";
import { readOrNull, type Read } from "../../../../lib/runtime.ts";

export interface Config {
  review: {
    /** Post every ready review draft each run with its draft verdict. Default false: report drafts only. */
    autoPost: boolean;
  };
  /** Repos (Orca display name, folder name, or `owner/repo`) the orchestrator never reports on or acts on. */
  ignore: string[];
}

export const defaultConfig = (): Config => ({ review: { autoPost: false }, ignore: [] });

export function parseConfig(text: string, source: string): Config {
  const shared = parseSharedConfig(text, source);
  const fail = (msg: string): never => { throw new Error(`${source}: orchestrator.${msg}`); };
  const section = toolSection(shared, "orchestrator", source);
  const out = defaultConfig();
  for (const [key, value] of Object.entries(section)) {
    if (key === "$comment") continue;
    if (key === "ignore") {
      if (!Array.isArray(value) || !value.every((x) => typeof x === "string" && x.length > 0)) fail("ignore must be an array of non-empty strings");
      out.ignore = [...(value as string[])];
    } else if (key === "review") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) fail("review must be an object");
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === "$comment") continue;
        if (k !== "autoPost") fail(`review: unknown key "${k}"`);
        if (typeof v !== "boolean") fail("review.autoPost must be a boolean");
        out.review.autoPost = v as boolean;
      }
    } else fail(`unknown key "${key}"`);
  }
  return out;
}

export type RepoKeys = { name?: string | null; path?: string | null; slug?: string | null };

/** Whether `orchestrator.ignore` names the repo by display name, folder name, or `owner/repo` (case-insensitive). */
export function isIgnored(cfg: Config, repo: RepoKeys): boolean {
  const keys = [repo.name, repo.path?.split("/").at(-1), repo.slug].filter((k): k is string => !!k).map((k) => k.toLowerCase());
  return cfg.ignore.some((r) => keys.includes(r.toLowerCase()));
}

/** The explicit file, else `AGENTIC_TOOLS_CONFIG`, else the first shared config path that exists, else defaults. */
export function loadConfig(explicit: string | undefined, env: NodeJS.ProcessEnv, read: Read = readOrNull): { config: Config; source: string } {
  const chosen = explicit ?? env.AGENTIC_TOOLS_CONFIG;
  if (chosen) {
    const text = read(chosen);
    if (text === null) throw new Error(`config file not found: ${chosen}`);
    return { config: parseConfig(text, chosen), source: chosen };
  }
  for (const path of configPaths(env)) {
    const text = read(path);
    if (text !== null) return { config: parseConfig(text, path), source: path };
  }
  return { config: defaultConfig(), source: "defaults" };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  try {
    const { values } = parseArgs({ args: process.argv.slice(2), options: { config: { type: "string" } }, strict: true });
    const { config, source } = loadConfig(values.config, process.env);
    process.stdout.write(`${JSON.stringify({ source, ...config }, null, 2)}\n`);
  } catch (e) {
    process.stderr.write(`orca-orchestrator config: ${(e as Error).message}\n`);
    process.exitCode = 2;
  }
}
