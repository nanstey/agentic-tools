import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CmdResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Run one child process with the caller's timeout. */
export function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd: string | undefined, timeoutMs: number): Promise<CmdResult> {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { env, cwd, maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, killSignal: "SIGKILL" }, (err, stdout, stderr) => {
      const killed = err && (err as { killed?: boolean }).killed;
      const msg = killed ? `${cmd} ${args.slice(0, 2).join(" ")} timed out after ${timeoutMs / 1000}s` : err && !stderr ? err.message : String(stderr);
      resolve({ ok: !err, stdout: String(stdout), stderr: msg });
    });
    child.stdin?.end();
  });
}

export function withoutTokens(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  return env;
}

export type Read = (path: string) => string | null;
export const readOrNull: Read = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
};

export function defaultStateDir(name: string, env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return join(env.XDG_STATE_HOME || join(home, ".local", "state"), name);
}

export function defaultConfigDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return env.XDG_CONFIG_HOME || join(home, ".config");
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}
