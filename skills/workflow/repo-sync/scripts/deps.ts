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
}

/** Every child process except `git merge` is killed after this long. */
export const CHILD_TIMEOUT_MS = 60_000;

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string, timeoutMs = CHILD_TIMEOUT_MS): Promise<CmdResult> {
  return runProcess(cmd, args, env, cwd, timeoutMs);
}

/** Real dependencies. `orca-ide`, never bare `orca` (the GNOME screen reader on some desktops). */
export function realDeps(): Deps {
  return {
    orcaRepos: () => run("orca-ide", ["repo", "list", "--json"], process.env),
    async git(cwd, args, extra) {
      const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1", LC_ALL: "C", ...extra };
      // Killing a merge mid-write leaves index.lock and partial files, so it runs to completion.
      return run("git", args, env, cwd, args[0] === "merge" ? 0 : CHILD_TIMEOUT_MS);
    },
    async ghToken(login) {
      const r = await run("gh", ["auth", "token", "-u", login], { ...withoutTokens(), GH_PROMPT_DISABLED: "1" });
      const tok = r.stdout.trim();
      return r.ok && tok ? tok : null;
    },
  };
}
