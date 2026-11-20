import { parseArgs } from "node:util";
import { defaultPaths, loadConfig } from "./config.ts";
import { nextState, renderDryRun, renderRun, renderStatus, runEvents } from "./report.ts";
import { parseRepoList } from "./repos.ts";
import type { Repo } from "./types.ts";
import type { Deps } from "./deps.ts";
import { defaultStateDir, pidAlive, Store } from "./store.ts";
import { syncAll } from "./sync.ts";

export const USAGE = `Usage: repo-sync <command> [options]

  run            Fast-forward the main checkout of every Orca-tracked repo
                 that is clean, on its default branch, and not ahead of
                 origin. Prints only what needs attention; nothing otherwise.
  run --dry-run  Print what run would do for every repo. No fetch, no merge,
                 no state written.
  status         Print the last run per repo.
  pause          Stop scheduled runs until resume (--reason <text>).
  resume         Resume scheduled runs.

Options:
  --config <path>     Shared config file (default: <repo-root>/config.json,
                      then \${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json).
                      AGENTIC_TOOLS_CONFIG also selects the file.
  --state-dir <path>  State directory (default:
                      \${XDG_STATE_HOME:-~/.local/state}/repo-sync).
  --format json       Machine output for status.
`;

export interface Io {
  deps: Deps;
  env: NodeJS.ProcessEnv;
  now: () => number;
  out: (s: string) => void;
  err: (s: string) => void;
  /** Liveness check for the pid in a lock file. */
  alive?: (pid: number) => boolean;
}

/** Repos from Orca, or from the last good listing when Orca cannot answer. */
async function listRepos(io: Io, store: Store, cache: boolean): Promise<Repo[] | null> {
  let problem: string;
  try {
    const r = await io.deps.orcaRepos();
    if (r.ok) {
      const repos = parseRepoList(r.stdout);
      if (cache) store.writeRepoCache(r.stdout);
      return repos;
    }
    problem = r.stderr.trim() || "orca-ide repo list failed";
  } catch (e) {
    problem = (e as Error).message;
  }
  const cached = store.readRepoCache();
  if (cached === null) {
    io.err(`repo-sync: cannot list Orca repos: ${problem}\n`);
    return null;
  }
  io.err(`repo-sync: warn: cannot list Orca repos (${problem}); using the cached list\n`);
  return parseRepoList(cached);
}

/** Run the CLI. Returns the exit code. */
export async function main(argv: string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "dry-run": { type: "boolean" },
        config: { type: "string" },
        "state-dir": { type: "string" },
        reason: { type: "string" },
        format: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (e) {
    io.err(`repo-sync: ${(e as Error).message}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const cmd = positionals[0];
  if (values.help || !cmd) {
    io.out(USAGE);
    return values.help ? 0 : 2;
  }
  const store = new Store(values["state-dir"] ?? defaultStateDir(io.env));

  try {
    switch (cmd) {
      case "status": {
        const last = store.readLast();
        const paused = store.paused();
        io.out(values.format === "json" ? `${JSON.stringify({ paused, last }, null, 2)}\n` : renderStatus(last, paused));
        return 0;
      }
      case "pause":
        store.pause(values.reason ?? "");
        io.out("repo-sync paused\n");
        return 0;
      case "resume":
        io.out(store.resume() ? "repo-sync resumed\n" : "repo-sync was not paused\n");
        return 0;
      case "run":
        return await runCmd(io, store, values["dry-run"] === true, values.config ?? io.env.AGENTIC_TOOLS_CONFIG);
      default:
        io.err(`repo-sync: unknown command "${cmd}"\n${USAGE}`);
        return 2;
    }
  } catch (e) {
    io.err(`repo-sync: ${(e as Error).message}\n`);
    return 1;
  }
}

async function runCmd(io: Io, store: Store, dryRun: boolean, configPath: string | undefined): Promise<number> {
  const load = () => loadConfig({ explicit: configPath, paths: defaultPaths(io.env) }).config;
  if (dryRun) {
    const config = load();
    const repos = await listRepos(io, store, false);
    if (!repos) return 1;
    const results = await syncAll(io.deps, repos, { config, dryRun: true });
    io.out(renderDryRun(results, store.paused() !== null));
    return 0;
  }
  // Scheduled runs: paused or overlapping runs exit 0 with no output.
  if (store.paused() !== null) return 0;
  store.ensureDir();
  if (!store.tryLock(io.now(), io.alive ?? pidAlive)) return 0;
  try {
    const config = load();
    const repos = await listRepos(io, store, true);
    if (!repos) return 1;
    const results = await syncAll(io.deps, repos, { config, dryRun: false });
    const at = new Date(io.now()).toISOString();
    const { state, notices } = nextState(store.readLast(), results, at);
    io.out(renderRun(notices, results));
    store.appendEvents(runEvents(state, results, at));
    store.writeLast(state);
    return 0;
  } finally {
    store.unlock();
  }
}
