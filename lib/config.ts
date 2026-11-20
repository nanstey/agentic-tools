import { dirname, join } from "node:path";
import { defaultConfigDir } from "./runtime.ts";
import { parseAccounts, type Account } from "./accounts.ts";

export const REPO_ROOT = dirname(import.meta.dirname);

export function configPaths(env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  const xdg = home === undefined ? defaultConfigDir(env) : defaultConfigDir(env, home);
  return [join(REPO_ROOT, "config.json"), join(xdg, "agentic-tools", "config.json")];
}

export interface SharedConfig {
  accounts: Account[];
  prflow: unknown;
  repoSync: unknown;
  taskStatus: unknown;
}

export function parseSharedConfig(text: string, source: string): SharedConfig {
  const fail = (message: string): never => { throw new Error(`${source}: ${message}`); };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return fail(`invalid JSON: ${(e as Error).message}`); }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("must be a JSON object");
  const value = raw as Record<string, unknown>;
  for (const key of Object.keys(value))
    if (!["$comment", "accounts", "prflow", "repoSync", "taskStatus"].includes(key)) fail(`unknown key "${key}"`);
  let accounts: Account[] = [];
  if (value.accounts !== undefined) {
    if (!Array.isArray(value.accounts)) fail("accounts must be an array");
    accounts = parseAccounts(value.accounts, fail);
  }
  return { accounts, prflow: value.prflow, repoSync: value.repoSync, taskStatus: value.taskStatus };
}
