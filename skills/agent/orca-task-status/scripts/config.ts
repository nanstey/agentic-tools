/** orca-task-status configuration, read from the shared agentic-tools config file. */
import { configPaths, parseSharedConfig, toolSection } from "../../../../lib/config.ts";
import type { Account } from "../../../../lib/accounts.ts";
import { readOrNull, type Read } from "../../../../lib/runtime.ts";
import { DEFAULT_STATUSES, parseTaskStatuses, type State } from "../../../../lib/task-status.ts";

export { DEFAULT_STATUSES } from "../../../../lib/task-status.ts";

export interface Config {
  accounts: Account[];
  /** Orca board status id per task state. Unset states cannot be written. */
  statuses: Partial<Record<State, string>>;
}

export function parseConfig(text: string, source: string): Config {
  const shared = parseSharedConfig(text, source);
  const fail = (msg: string): never => { throw new Error(`${source}: taskStatus.${msg}`); };
  return { accounts: shared.accounts, statuses: parseTaskStatuses(toolSection(shared, "taskStatus", source), fail) };
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
