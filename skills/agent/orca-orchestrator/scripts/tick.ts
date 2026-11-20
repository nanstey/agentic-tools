#!/usr/bin/env node
/**
 * orca-orchestrator tick: the `--precheck` command of the orchestrator bot's
 * Orca automation.
 *
 * Runs `repo-sync run`, `prflow watch`, and `prflow status --format json` in
 * parallel with the same node, writes their combined feed to
 * `<state>/feed/<stamp>.txt` and `<state>/latest.txt`, and prints the feed
 * path. Exit 0 only when the feed is non-empty, so Orca starts an agent run
 * only when there is something to read. A tool failure is a feed entry.
 *
 * It never runs `prflow tick`: an automation precheck has no Orca terminal, so
 * `orca-ide orchestration send` fails there (`no_active_sender_terminal`). The
 * bot's run executes `prflow tick` itself.
 */
import { spawn } from "node:child_process";
import { closeSync, linkSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { defaultStateDir, pidAlive } from "../../../../lib/runtime.ts";
import { composeFeed, dueDispatches, failureOf, filterRepeats, pruneList, stamp, type Failure, type FailureMemory, type ToolRun } from "./core.ts";

export const USAGE = `Usage: tick.ts [options]

Precheck for the orchestrator bot. Runs repo-sync and prflow watch, writes the
feed, prints its path, and exits 0 only when the feed is non-empty.

Options:
  --state-dir <path>        State directory (default \${XDG_STATE_HOME:-~/.local/state}/orca-orchestrator).
  --keep <n>                Feeds and run outputs to keep (default 200).
  --timeout-seconds <n>     Wait at most this long for the tools (default 150). A
                            tool still running is left to finish, never killed.
  --watch-name <name>       prflow watch job name (default orca-orchestrator).
  --config <path>           Shared config file passed to repo-sync and prflow.
  --prflow <path>           prflow.ts (default: this checkout's prflow skill).
  --repo-sync <path>        repo-sync.ts (default: this checkout's repo-sync skill).

Exit: 0 feed written; 1 nothing to read; 2 bad usage; 70 cannot write state;
75 another tick is running. Any non-zero exit makes Orca skip the run.
`;

export const EXIT = { feed: 0, empty: 1, usage: 2, internal: 70, busy: 75 } as const;

const STALE_LOCK_MS = 30 * 60 * 1000;

export interface Options {
  stateDir: string;
  keep: number;
  timeoutMs: number;
  watchName: string;
  config?: string;
  prflow: string;
  repoSync: string;
  node: string;
  env: NodeJS.ProcessEnv;
  now: () => number;
}

interface Tool {
  name: string;
  file: string;
  args: string[];
}

/** Run one tool detached with output in files. At the deadline it is left running, never killed. */
function runTool(t: Tool, o: Options, dir: string): Promise<ToolRun> {
  const base = t.name.replace(/[^a-z0-9]+/gi, "-");
  const outPath = join(dir, `${base}.out`);
  const errPath = join(dir, `${base}.err`);
  const read = (p: string) => {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return "";
    }
  };
  return new Promise((done) => {
    const out = openSync(outPath, "w");
    const err = openSync(errPath, "w");
    let settled = false;
    const finish = (exitCode: number | null, timedOut: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done({ name: t.name, exitCode, timedOut, stdout: read(outPath), stderr: read(errPath), outPath, errPath, ...(error ? { error } : {}) });
    };
    const child = spawn(o.node, [t.file, ...t.args], { detached: true, stdio: ["ignore", out, err], env: o.env });
    closeSync(out);
    closeSync(err);
    const timer = setTimeout(() => {
      child.unref();
      finish(null, true);
    }, o.timeoutMs);
    child.on("error", (e) => finish(null, false, e.message));
    child.on("exit", (code, signal) => finish(code ?? (signal ? 128 : null), false));
  });
}

/** Take `<dir>/lock`, or return null when a live tick holds it. A dead or 30-minute-old holder is taken over. */
function lock(dir: string, now: number): string | null {
  const path = join(dir, "lock");
  for (let i = 0; i < 2; i++) {
    try {
      const fd = openSync(path, "wx");
      const content = JSON.stringify({ pid: process.pid, at: now });
      writeSync(fd, content);
      closeSync(fd);
      return content;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let content: string | null = null;
      let held: { pid?: number; at?: number } = {};
      try {
        content = readFileSync(path, "utf8");
        held = JSON.parse(content) as typeof held;
      } catch {
        /* empty, corrupt, or unreadable: judged by file age below */
      }
      let at = held.at;
      if (typeof at !== "number") {
        try {
          at = statSync(path).mtimeMs;
        } catch {
          continue; // Released between open and stat; retry.
        }
      }
      const fresh = now - at < STALE_LOCK_MS;
      if (typeof held.pid === "number" && pidAlive(held.pid) && fresh) return null;
      if (typeof held.pid !== "number" && fresh) return null;
      const renamed = `${path}.stale.${process.pid}`;
      try {
        renameSync(path, renamed);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw e;
      }
      let ours = false;
      try {
        ours = readFileSync(renamed, "utf8") === content;
      } catch {
        /* cannot verify ownership: restore it */
      } finally {
        if (!ours) {
          try {
            linkSync(renamed, path);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") renameSync(renamed, path);
          }
        }
        rmSync(renamed, { force: true });
      }
      if (!ours) return null;
    }
  }
  return null;
}

function unlock(dir: string, content: string): void {
  const path = join(dir, "lock");
  try {
    if (readFileSync(path, "utf8") === content) rmSync(path, { force: true });
  } catch {
    /* already released or replaced */
  }
}

function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function readMemory(path: string): FailureMemory {
  try {
    const v = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as FailureMemory) : {};
  } catch {
    return {};
  }
}

function prune(dir: string, keep: number): void {
  for (const name of pruneList(readdirSync(dir), keep)) rmSync(join(dir, name), { recursive: true, force: true });
}

/** One precheck run. Returns the exit code; prints the feed path on 0. */
export async function tick(o: Options, out: (s: string) => void, err: (s: string) => void): Promise<number> {
  const at = new Date(o.now());
  const feedDir = join(o.stateDir, "feed");
  const runDir = join(o.stateDir, "runs", stamp(at));
  try {
    mkdirSync(o.stateDir, { recursive: true });
  } catch (e) {
    err(`orca-orchestrator: cannot write state: ${(e as Error).message}\n`);
    return EXIT.internal;
  }
  let lockContent: string | null;
  try {
    lockContent = lock(o.stateDir, at.getTime());
  } catch (e) {
    err(`orca-orchestrator: cannot write state: ${(e as Error).message}\n`);
    return EXIT.internal;
  }
  if (lockContent === null) {
    err("orca-orchestrator: another tick is running\n");
    return EXIT.busy;
  }
  try {
    mkdirSync(feedDir, { recursive: true });
    mkdirSync(runDir, { recursive: true });
  } catch (e) {
    unlock(o.stateDir, lockContent);
    err(`orca-orchestrator: cannot write state: ${(e as Error).message}\n`);
    return EXIT.internal;
  }
  try {
    const cfg = o.config ? ["--config", o.config] : [];
    const [sync, watch, status] = await Promise.all([
      runTool({ name: "repo-sync", file: o.repoSync, args: ["run", ...cfg] }, o, runDir),
      runTool({ name: "prflow watch", file: o.prflow, args: ["watch", "--name", o.watchName, ...cfg] }, o, runDir),
      runTool({ name: "prflow status", file: o.prflow, args: ["status", "--format", "json", ...cfg] }, o, runDir),
    ]);
    const failures: Failure[] = [];
    for (const r of [sync, watch, status]) {
      const f = failureOf(r);
      if (f) failures.push(f);
    }
    let due: ReturnType<typeof dueDispatches> = [];
    if (status.exitCode === 0 && !status.timedOut) {
      try {
        due = dueDispatches(status.stdout, at.getTime());
      } catch (e) {
        failures.push({ signature: "prflow status|parse", text: `- prflow status: unreadable reply (${(e as Error).message}). Output: ${status.outPath}` });
      }
    }
    const memPath = join(o.stateDir, "failures.json");
    const { report, memory } = filterRepeats(failures, readMemory(memPath), at.getTime());
    writeAtomic(memPath, `${JSON.stringify(memory, null, 2)}\n`);
    const feed = composeFeed({ at, runs: [sync, watch], due, failures: report });
    if (!feed) return EXIT.empty;
    const path = join(feedDir, `${stamp(at)}.txt`);
    writeAtomic(path, feed);
    writeAtomic(join(o.stateDir, "latest.txt"), feed);
    prune(feedDir, o.keep);
    prune(join(o.stateDir, "runs"), o.keep);
    out(`${path}\n`);
    return EXIT.feed;
  } catch (e) {
    err(`orca-orchestrator: ${(e as Error).message}\n`);
    return EXIT.internal;
  } finally {
    unlock(o.stateDir, lockContent);
  }
}

/** Parse argv into options. Throws a usage message on bad input. */
export function parseOptions(argv: string[], env: NodeJS.ProcessEnv, here: string): Options {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "state-dir": { type: "string" },
      keep: { type: "string" },
      "timeout-seconds": { type: "string" },
      "watch-name": { type: "string" },
      config: { type: "string" },
      prflow: { type: "string" },
      "repo-sync": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) throw new Error(USAGE);
  if (positionals.length) throw new Error(`unexpected argument: ${positionals[0]}\n\n${USAGE}`);
  const int = (v: string | undefined, d: number, name: string) => {
    if (v === undefined) return d;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`);
    return n;
  };
  const watchName = values["watch-name"] ?? "orca-orchestrator";
  if (!/^[A-Za-z0-9_-]+$/.test(watchName)) throw new Error("--watch-name must be letters, digits, _ or -");
  const skills = resolve(here, "..", "..", "..");
  return {
    stateDir: resolve(values["state-dir"] ?? defaultStateDir("orca-orchestrator", env)),
    keep: int(values.keep, 200, "keep"),
    timeoutMs: int(values["timeout-seconds"], 150, "timeout-seconds") * 1000,
    watchName,
    ...(values.config ? { config: resolve(values.config) } : {}),
    prflow: resolve(values.prflow ?? join(skills, "workflow", "prflow", "scripts", "prflow.ts")),
    repoSync: resolve(values["repo-sync"] ?? join(skills, "workflow", "repo-sync", "scripts", "repo-sync.ts")),
    node: process.execPath,
    env,
    now: Date.now,
  };
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(realpathSync(entry)).href) {
  let opts: Options;
  try {
    opts = parseOptions(process.argv.slice(2), process.env, dirname(realpathSync(new URL(import.meta.url))));
  } catch (e) {
    const msg = (e as Error).message;
    process.stderr.write(msg.endsWith("\n") ? msg : `${msg}\n`);
    process.exit(msg === USAGE ? 0 : EXIT.usage);
  }
  process.exitCode = await tick(opts, (s) => process.stdout.write(s), (s) => process.stderr.write(s));
}
