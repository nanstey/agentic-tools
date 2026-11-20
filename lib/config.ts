import { dirname, join } from "node:path";
import { defaultConfigDir } from "./runtime.ts";
import { parseAccounts, type Account } from "./accounts.ts";

export const REPO_ROOT = dirname(import.meta.dirname);

export function configPaths(env: NodeJS.ProcessEnv = process.env, home?: string): string[] {
  const xdg = home === undefined ? defaultConfigDir(env) : defaultConfigDir(env, home);
  return [join(REPO_ROOT, "config.json"), join(xdg, "agentic-tools", "config.json")];
}

/**
 * The shared file holds one top-level section per tool plus `accounts`. Each tool
 * reads its own section with `toolSection` and ignores sections it does not own,
 * so adding a section for a new tool never breaks the others.
 */
export interface SharedConfig {
  accounts: Account[];
  /** Every top-level value except `accounts`, keyed by section name. */
  sections: Record<string, unknown>;
}

export function parseSharedConfig(text: string, source: string): SharedConfig {
  const fail = (message: string): never => { throw new Error(`${source}: ${message}`); };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return fail(`invalid JSON: ${(e as Error).message}`); }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("must be a JSON object");
  const { accounts: rawAccounts, ...sections } = raw as Record<string, unknown>;
  let accounts: Account[] = [];
  if (rawAccounts !== undefined) {
    if (!Array.isArray(rawAccounts)) fail("accounts must be an array");
    accounts = parseAccounts(rawAccounts, fail);
  }
  return { accounts, sections };
}

/** A tool's own section as an object (`{}` when absent). The caller stays strict about keys inside it. */
export function toolSection(shared: SharedConfig, name: string, source: string): Record<string, unknown> {
  const section = Object.hasOwn(shared.sections, name) ? shared.sections[name] : undefined;
  if (section === undefined) return {};
  if (typeof section !== "object" || section === null || Array.isArray(section)) throw new Error(`${source}: ${name} must be an object`);
  return section as Record<string, unknown>;
}
