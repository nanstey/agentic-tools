import { existsSync } from "node:fs";
import { run as runProcess, withoutTokens } from "../../../../lib/runtime.ts";
import type { CmdResult } from "../../../../lib/runtime.ts";
export type { CmdResult } from "../../../../lib/runtime.ts";

/** Every side effect repo-sync has. Tests replace it with fakes. */
export interface Deps {
  /** `orca-ide repo list --json`. */
  orcaRepos(): Promise<CmdResult>;
  /** Run a git command built by `scripts/git.ts` in `cwd`. */
  git(cwd: string, args: string[], env?: Record<string, string>): Promise<CmdResult>;
  /** Token of a gh account, or `null`. Never switches the active account. */
  ghToken(login: string): Promise<string | null>;
  /** The file exists. Used only to find git's `index.lock`. */
  exists(path: string): boolean;
}

/** Every child process except `git merge` is killed with SIGKILL after this long. */
export const CHILD_TIMEOUT_MS = 60_000;

/**
 * `git merge` gets this long, then SIGTERM, so git can remove its own `index.lock`.
 * Long enough for a large or LFS checkout; short enough that a hung merge cannot
 * hold the run lock forever. Any partial checkout is then reported as `merge-interrupted`.
 */
export const MERGE_TIMEOUT_MS = 30 * 60_000;

/** Timeout and kill signal for one git command. */
export function gitLimits(args: string[]): { timeoutMs: number; signal: NodeJS.Signals } {
  return args[0] === "merge" ? { timeoutMs: MERGE_TIMEOUT_MS, signal: "SIGTERM" } : { timeoutMs: CHILD_TIMEOUT_MS, signal: "SIGKILL" };
}

/** Variables that would point git at another repository, index, or work tree (set when started from a git hook). */
const GIT_LOCATION_VARS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_COMMON_DIR", "GIT_NAMESPACE", "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM", "GIT_PREFIX"];

/** Environment for a git child: the caller's, without git location overrides, never prompting. */
export function gitEnv(base: NodeJS.ProcessEnv, extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1", LC_ALL: "C" };
  for (const k of GIT_LOCATION_VARS) delete env[k];
  return { ...env, ...extra };
}

/** Real dependencies. `orca-ide`, never bare `orca` (the GNOME screen reader on some desktops). */
export function realDeps(): Deps {
  return {
    orcaRepos: () => runProcess("orca-ide", ["repo", "list", "--json"], process.env, undefined, CHILD_TIMEOUT_MS),
    async git(cwd, args, extra) {
      const { timeoutMs, signal } = gitLimits(args);
      return runProcess("git", args, gitEnv(process.env, extra), cwd, timeoutMs, signal);
    },
    async ghToken(login) {
      const r = await runProcess("gh", ["auth", "token", "-u", login], { ...withoutTokens(), GH_PROMPT_DISABLED: "1" }, undefined, CHILD_TIMEOUT_MS);
      const tok = r.stdout.trim();
      return r.ok && tok ? tok : null;
    },
    exists: (path) => existsSync(path),
  };
}
