import { execFile } from "node:child_process";
import { assertReadOnly, assertRerun, rerunArgs } from "./adapters/gh.ts";
import { assertDeleteBranch, deleteBranchArgs } from "./adapters/git.ts";
import { agentListArgs, archiveArgs, assertArchive, assertOrca, closeArgs, launchArgs, sendArgs, terminalListArgs, worktreeListArgs } from "./adapters/orca.ts";
import type { CmdResult } from "./scan.ts";
import type { TickDeps } from "./tick.ts";

/** Default limit for one child process; `setChildTimeout` overrides it from config. */
let childTimeoutMs = 60_000;

/** Run a child process. It is killed after the child timeout and reported as a failure. */
function run(cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd?: string): Promise<CmdResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { env, cwd, maxBuffer: 64 * 1024 * 1024, timeout: childTimeoutMs, killSignal: "SIGKILL" }, (err, stdout, stderr) => {
      const killed = err && (err as { killed?: boolean }).killed;
      const msg = killed ? `${cmd} ${args.slice(0, 2).join(" ")} timed out after ${childTimeoutMs / 1000}s` : err && !stderr ? err.message : String(stderr);
      resolve({ ok: !err, stdout: String(stdout), stderr: msg });
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

export interface RealDeps extends TickDeps {
  /** Login of the active gh account (ambient auth). */
  whoami(): Promise<string>;
  /** Limit every later child process to `ms`. */
  setChildTimeout(ms: number): void;
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

  /** Every `orca-ide` call passes the Orca allowlist first. `orca-ide`, never bare `orca` (the GNOME screen reader on some desktops). */
  const orca = (args: string[]) => {
    assertOrca(args);
    return run("orca-ide", args, process.env);
  };

  return {
    whoami,
    now: () => Date.now(),
    setChildTimeout(ms) {
      childTimeoutMs = ms;
    },
    async gh(login, args) {
      assertReadOnly(args);
      const env = await envFor(login);
      return typeof env === "string" ? { ok: false, stdout: "", stderr: env } : run("gh", args, env);
    },
    async orcaWorktrees() {
      const r = await orca(worktreeListArgs());
      if (!r.ok) throw new Error(r.stderr.trim());
      return r.stdout;
    },
    orcaAgents: () => orca(agentListArgs()),
    orcaTerminals: (worktreeId) => orca(terminalListArgs(worktreeId)),
    launchPi: (worktreeId, prompt) => orca(launchArgs(worktreeId, prompt)),
    sendToAgent: (handle, subject, body) => orca(sendArgs(handle, subject, body)),
    closeTerminal: (handle) => orca(closeArgs(handle)),
    async gitDirty(path) {
      const r = await run("git", ["status", "--porcelain"], process.env, path);
      return r.ok ? r.stdout.split("\n").filter(Boolean).length : null;
    },
    async rerunFailed(login, repo, runId) {
      const args = rerunArgs(repo, runId);
      assertRerun(args);
      const env = await envFor(login);
      return typeof env === "string" ? { ok: false, stdout: "", stderr: env } : run("gh", args, env);
    },
    async gitUnpushed(path, prHeadSha) {
      const head = await run("git", ["rev-parse", "HEAD"], process.env, path);
      if (!head.ok) return null;
      const sha = head.stdout.trim();
      if (prHeadSha && sha === prHeadSha) return 0;
      // HEAD is part of what the PR pushed (the PR head may be gone after a squash merge).
      if (prHeadSha && (await run("git", ["merge-base", "--is-ancestor", "HEAD", prHeadSha], process.env, path)).ok) return 0;
      const r = await run("git", ["rev-list", "--count", "HEAD", "--not", "--remotes"], process.env, path);
      const n = Number(r.stdout.trim());
      return r.ok && Number.isInteger(n) ? n : null;
    },
    async archiveWorktree(path) {
      const args = archiveArgs(path);
      assertArchive(args);
      return orca(args);
    },
    async branchInfo(path) {
      const dir = await run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], process.env, path);
      const head = await run("git", ["rev-parse", "HEAD"], process.env, path);
      if (!dir.ok || !head.ok) return null;
      const ref = await run("git", ["symbolic-ref", "-q", "--short", "HEAD"], process.env, path);
      return { gitDir: dir.stdout.trim(), branch: ref.ok ? ref.stdout.trim() || null : null, sha: head.stdout.trim() };
    },
    async deleteBranch(gitDir, branch, sha) {
      const args = deleteBranchArgs(gitDir, branch, sha);
      assertDeleteBranch(args);
      const wt = await run("git", ["--git-dir", gitDir, "worktree", "list", "--porcelain"], process.env);
      if (!wt.ok) return wt;
      if (wt.stdout.split("\n").includes(`branch refs/heads/${branch}`))
        return { ok: false, stdout: "", stderr: `${branch} is still checked out in a worktree` };
      return run("git", args, process.env);
    },
  };
}
