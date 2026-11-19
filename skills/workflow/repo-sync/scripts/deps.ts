import { execFile } from "node:child_process";
import { assertGit } from "./git.ts";

export interface CmdResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Every side effect repo-sync has. Tests replace it with fakes. */
export interface Deps {
  /** `orca-ide repo list --json`. */
  orcaRepos(): Promise<CmdResult>;
  /** Run one allowlisted git command in `cwd`. Throws before spawning when `args` is not allowed. */
  git(cwd: string, args: string[], env?: Record<string, string>): Promise<CmdResult>;
  /** Token of a gh account, or `null`. Never switches the active account. */
  ghToken(login: string): Promise<string | null>;
}

/** Every child process is killed after this long. */
export const CHILD_TIMEOUT_MS = 60_000;

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<CmdResult> {
  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      { env, cwd, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS, killSignal: "SIGKILL" },
      (err, stdout, stderr) => {
        const killed = err && (err as { killed?: boolean }).killed;
        const msg = killed ? `${cmd} ${args.slice(0, 2).join(" ")} timed out after ${CHILD_TIMEOUT_MS / 1000}s` : err && !stderr ? err.message : String(stderr);
        resolve({ ok: !err, stdout: String(stdout), stderr: msg });
      },
    );
    child.stdin?.end();
  });
}

/** Environment without ambient GitHub tokens. */
function withoutTokens(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  return env;
}

/** Real dependencies. `orca-ide`, never bare `orca` (the GNOME screen reader on some desktops). */
export function realDeps(): Deps {
  return {
    orcaRepos: () => run("orca-ide", ["repo", "list", "--json"], process.env),
    async git(cwd, args, extra) {
      assertGit(args);
      const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1", LC_ALL: "C", ...extra };
      return run("git", args, env, cwd);
    },
    async ghToken(login) {
      const r = await run("gh", ["auth", "token", "-u", login], { ...withoutTokens(), GH_PROMPT_DISABLED: "1" });
      const tok = r.stdout.trim();
      return r.ok && tok ? tok : null;
    },
  };
}
