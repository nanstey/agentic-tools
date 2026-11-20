import { defaultConfig, type Config } from "../scripts/config.ts";
import type { Repo } from "../scripts/types.ts";
import type { CmdResult, Deps } from "../scripts/deps.ts";

/** `orca-ide repo list --json` with every entry kind repo-sync must handle. */
export const ORCA_LIST = {
  id: "x",
  ok: true,
  result: {
    repos: [
      { id: "r1", path: "/repos/work", displayName: "work", kind: "git", executionHostId: "local", gitRemoteIdentity: { canonicalKey: "github.com-work/WorkOrg/work", remoteName: "origin", remoteUrl: "git@github.com-work:WorkOrg/work.git" }, upstream: null },
      { id: "r2", path: "/repos/web", displayName: "web", kind: "git", executionHostId: "local", worktreeBaseRef: "origin/trunk", gitRemoteIdentity: { remoteName: "origin", remoteUrl: "https://github.com/me/web.git" } },
      { id: "f1", path: "/repos/folder", displayName: "folder", kind: "folder", executionHostId: "local" },
      { id: "h1", path: "/repos/hidden", displayName: "hidden", kind: "git", hiddenAt: 1791921372370, gitRemoteIdentity: { remoteName: "origin", remoteUrl: "git@github.com:me/hidden.git" } },
      { id: "s1", path: "/srv/remote", displayName: "remote-host", kind: "git", executionHostId: "ssh-box", gitRemoteIdentity: { remoteName: "origin", remoteUrl: "git@github.com:me/remote.git" } },
      { id: "n1", path: "/repos/local-only", displayName: "local-only", kind: "git", executionHostId: "local" },
    ],
  },
};

export const SHA_A = "a".repeat(40);
export const SHA_B = "b".repeat(40);

export const ok = (stdout = ""): CmdResult => ({ ok: true, stdout, stderr: "" });
export const err = (stderr: string): CmdResult => ({ ok: false, stdout: "", stderr });

export function repo(over: Partial<Repo> = {}): Repo {
  return { id: "r", path: "/repos/app", name: "app", slug: "me/app", remoteName: "origin", remoteUrl: "git@github.com:me/app.git", baseRef: null, ...over };
}

export function config(over: Partial<Config> = {}): Config {
  return { ...defaultConfig(), ...over };
}

export interface Call {
  cwd: string;
  args: string[];
  env?: Record<string, string>;
}

type Reply = CmdResult | ((env?: Record<string, string>) => CmdResult);

/**
 * Fake deps. `git` answers from `script` keyed by `<cwd>|<args>`, uses scripted
 * replies and throws on any unscripted call so a test fails if sync
 * runs a command it did not expect.
 */
export function fakeDeps(script: Record<string, Reply>, opts: { list?: CmdResult; tokens?: Record<string, string> } = {}) {
  const calls: Call[] = [];
  const tokenCalls: string[] = [];
  const deps: Deps = {
    async orcaRepos() {
      return opts.list ?? ok(JSON.stringify(ORCA_LIST));
    },
    async git(cwd, args, env) {
      calls.push(env ? { cwd, args, env } : { cwd, args });
      const reply = script[`${cwd}|${args.join(" ")}`];
      if (reply === undefined) throw new Error(`unexpected git call: ${cwd} ${args.join(" ")}`);
      return typeof reply === "function" ? reply(env) : reply;
    },
    async ghToken(login) {
      tokenCalls.push(login);
      return opts.tokens?.[login] ?? null;
    },
  };
  return { deps, calls, tokenCalls };
}

export interface RepoScript {
  current?: string;
  originHead?: CmdResult;
  status?: string;
  fetch?: Reply;
  /** [ahead, behind] */
  counts?: [number, number];
  count?: CmdResult;
  merge?: CmdResult;
  log?: string;
  diff?: string;
}

/** Script for one checkout; defaults describe a clean `main` that is 2 behind origin and merges cleanly. */
export function scriptRepo(path: string, s: RepoScript = {}, branch = "main"): Record<string, Reply> {
  let merged = false;
  const [ahead, behind] = s.counts ?? [0, 2];
  return {
    [`${path}|rev-parse --abbrev-ref HEAD`]: ok(`${s.current ?? branch}\n`),
    [`${path}|rev-parse --abbrev-ref origin/HEAD`]: s.originHead ?? ok(`origin/${branch}\n`),
    [`${path}|status --porcelain`]: ok(s.status ?? ""),
    [`${path}|fetch origin ${branch}`]: s.fetch ?? ok(),
    [`${path}|rev-list --left-right --count HEAD...origin/${branch}`]: s.count ?? ok(`${ahead}\t${behind}\n`),
    [`${path}|rev-parse HEAD`]: () => ok(`${merged ? SHA_B : SHA_A}\n`),
    [`${path}|merge --ff-only --no-overwrite-ignore origin/${branch}`]: () => {
      const r = s.merge ?? ok("Fast-forward\n");
      if (r.ok) merged = true;
      return r;
    },
    [`${path}|log --oneline --no-decorate -n 10 ${SHA_A}..${SHA_B}`]: ok(s.log ?? "b1 two\nb0 one\n"),
    [`${path}|diff --name-only ${SHA_A} ${SHA_B}`]: ok(s.diff ?? "README.md\nsrc/a.ts\n"),
  };
}

export const ranArgs = (calls: Call[]) => calls.map((c) => c.args.join(" "));
