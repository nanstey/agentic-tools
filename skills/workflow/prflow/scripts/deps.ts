import { execFile } from "node:child_process";
import { assertReadOnly } from "./adapters/gh.ts";
import type { CmdResult, Deps } from "./scan.ts";

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<CmdResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { env, cwd, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout), stderr: err && !stderr ? err.message : String(stderr) });
    });
  });
}

/** Environment without any ambient GitHub token, so the per-account token always wins. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  return env;
}

/**
 * Real dependencies. Every gh call runs with `GH_TOKEN` from `gh auth token -u <me>`
 * (never `gh auth switch`) and passes the read-only allowlist first.
 */
export async function realDeps(me: string): Promise<Deps> {
  const tok = await run("gh", ["auth", "token", "-u", me], cleanEnv());
  if (!tok.ok || !tok.stdout.trim()) throw new Error(`gh auth token -u ${me} failed: ${tok.stderr.trim()}`);
  const env = { ...cleanEnv(), GH_TOKEN: tok.stdout.trim(), GH_PROMPT_DISABLED: "1" };
  return {
    gh(args) {
      assertReadOnly(args);
      return run("gh", args, env);
    },
    async orcaWorktrees() {
      const r = await run("orca", ["worktree", "list", "--limit", "1000", "--json"], process.env);
      if (!r.ok) throw new Error(r.stderr.trim());
      return r.stdout;
    },
    async gitDirty(path) {
      const r = await run("git", ["status", "--porcelain"], process.env, path);
      return r.ok ? r.stdout.split("\n").filter(Boolean).length : null;
    },
  };
}
