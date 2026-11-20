/** orca-task-status configuration, read from the shared agentic-tools config file. */
import { configPaths, parseSharedConfig } from "../../../../lib/config.ts";
import type { Account } from "../../../../lib/accounts.ts";
import { readOrNull, type Read } from "../../../../lib/runtime.ts";
import { isState, STATES, type State } from "./core.ts";

export interface Config {
  accounts: Account[];
  /** Orca board status id per task state. Unset states cannot be written. */
  statuses: Partial<Record<State, string>>;
}

/** Orca's built-in board columns. Paused, Blocked, and Needs Attention are custom columns with generated ids. */
export const DEFAULT_STATUSES: Partial<Record<State, string>> = { "in-progress": "in-progress", "in-review": "in-review", done: "completed" };

export function parseConfig(text: string, source: string): Config {
  const shared = parseSharedConfig(text, source);
  const fail = (msg: string): never => { throw new Error(`${source}: taskStatus.${msg}`); };
  const raw = shared.taskStatus;
  if (raw !== undefined && (typeof raw !== "object" || raw === null || Array.isArray(raw))) throw new Error(`${source}: taskStatus must be an object`);
  const section = (raw ?? {}) as Record<string, unknown>;
  const statuses: Partial<Record<State, string>> = { ...DEFAULT_STATUSES };
  for (const [key, value] of Object.entries(section)) {
    if (key === "$comment") continue;
    if (key !== "statuses") fail(`unknown key "${key}"`);
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail("statuses must be an object");
    for (const [state, id] of Object.entries(value as Record<string, unknown>)) {
      if (state === "$comment") continue;
      if (!isState(state)) fail(`statuses has unknown state "${state}" (expected ${STATES.join(", ")})`);
      if (typeof id !== "string" || id.length === 0) fail(`statuses.${state} must be a non-empty string`);
      statuses[state as State] = id as string;
    }
  }
  return { accounts: shared.accounts, statuses };
}

/** The explicit file, else `AGENTIC_TOOLS_CONFIG`, else the first shared config path that exists, else defaults. */
export function loadConfig(explicit: string | undefined, env: NodeJS.ProcessEnv, read: Read = readOrNull): Config {
  const chosen = explicit ?? env.AGENTIC_TOOLS_CONFIG;
  if (chosen) {
    const text = read(chosen);
    if (text === null) throw new Error(`config file not found: ${chosen}`);
    return parseConfig(text, chosen);
  }
  for (const path of configPaths(env)) {
    const text = read(path);
    if (text !== null) return parseConfig(text, path);
  }
  return { accounts: [], statuses: { ...DEFAULT_STATUSES } };
}
