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

/** Environment without any ambient GitHub token, so a per-account token always wins. */
function withoutTokens(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  return env;
}

export interface RealDeps extends Deps {
  /** Login of the active gh account (ambient auth). */
  whoami(): Promise<string>;
}

/**
 * Real dependencies. Each account's gh calls run with `GH_TOKEN` from
 * `gh auth token -u <login>` (never `gh auth switch`). If that lookup fails for
 * the active account (for example auth comes only from `GH_TOKEN`), its calls use
 * ambient auth. Every gh call passes the read-only allowlist first.
 */
export function realDeps(): RealDeps {
  const ambient: NodeJS.ProcessEnv = { ...process.env, GH_PROMPT_DISABLED: "1" };
  const envs = new Map<string, Promise<NodeJS.ProcessEnv | string>>();
  let me: Promise<string> | undefined;

  const ambientGh = (args: string[]) => {
    assertReadOnly(args);
    return run("gh", args, ambient);
  };
  const whoami = () =>
    (me ??= ambientGh(["api", "graphql", "-f", "query=query{viewer{login}}"]).then((r) => {
      let login: string | undefined;
      try {
        if (r.ok) login = (JSON.parse(r.stdout) as { data?: { viewer?: { login?: string } } }).data?.viewer?.login;
      } catch {
        // Fall through to the error below.
      }
      if (!login) throw new Error(`cannot resolve the active gh account; pass --user or add a config: ${r.stderr.trim()}`);
      return login;
    }));
  /** Env for `login`, or an error message. */
  const envFor = (login: string) => {
    let p = envs.get(login);
    if (!p) {
      p = run("gh", ["auth", "token", "-u", login], withoutTokens()).then(async (tok) => {
        if (tok.ok && tok.stdout.trim())
          return { ...withoutTokens(), GH_TOKEN: tok.stdout.trim(), GH_PROMPT_DISABLED: "1" };
        const active = await whoami().catch(() => "");
        if (active.toLowerCase() === login.toLowerCase()) return ambient;
        return `no gh token for ${login} (run gh auth login): ${tok.stderr.trim()}`;
      });
      envs.set(login, p);
    }
    return p;
  };

  return {
    whoami,
    async gh(login, args) {
      assertReadOnly(args);
      const env = await envFor(login);
      return typeof env === "string" ? { ok: false, stdout: "", stderr: env } : run("gh", args, env);
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
