import { run as systemRun } from "../../../../lib/runtime.ts";

export interface CommandResult { ok: boolean; stdout: string; stderr: string; exitCode?: number }
export type CommandRunner = (command: string, args: string[], env?: NodeJS.ProcessEnv, cwd?: string, timeoutMs?: number) => Promise<CommandResult>;
export interface Clock { now(): number; sleep(ms: number): Promise<void> }
export const systemClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
export const systemRunner: CommandRunner = (command, args, env = process.env, cwd, timeoutMs = 0) => systemRun(command, args, env, cwd, timeoutMs);

export class BlockedError extends Error { constructor(gate: string, evidence: string, state: string) { super(`blocked: ${gate} — ${evidence}; unblock requires: ${state}`); } }
export function blocked(gate: string, evidence: string, state: string): never { throw new BlockedError(gate, evidence, state); }

/** GitHub writes are denied unless their named operation is explicitly enabled. */
export const GITHUB_WRITE_ALLOWLIST = new Set(["draft", "push", "rerequest", "rerun-check", "edit-body", "attach", "merge", "review-reaction", "stack-link", "review-post", "thread-reply", "thread-resolve"]);
export async function invoke(runner: CommandRunner, command: string, args: string[], options: { cwd?: string; write?: string } = {}): Promise<string> {
  if (command === "gh" && options.write && !GITHUB_WRITE_ALLOWLIST.has(options.write)) blocked("write allowlist", options.write, "an allowlisted GitHub mutation");
  const result = await runner(command, args, process.env, options.cwd);
  if (!result.ok) blocked(`${command} API`, result.stderr || result.stdout || "command failed", "successful command with complete data");
  return result.stdout.trim();
}
export function parseJson<T>(value: string, validate: (input: unknown) => input is T, source: string): T {
  let input: unknown;
  try { input = JSON.parse(value) as unknown; } catch { return blocked("invalid API response", `${source} returned malformed JSON`, "valid complete JSON"); }
  if (!validate(input)) return blocked("invalid API response", `${source} returned an unexpected shape`, "valid complete JSON");
  return input;
}
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
export function requireRun(id: string | undefined): string { if (!id) return blocked("run id", "mutating operation requires --run <id>", "an active PR run id"); return id; }
