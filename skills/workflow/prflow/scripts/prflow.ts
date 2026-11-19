#!/usr/bin/env node
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { summarizeChecks, version } from "./core/classify.ts";
import { renderReport, sortItems } from "./core/report.ts";
import type { PrSnapshot } from "./core/types.ts";
import { realDeps } from "./deps.ts";
import { loadConfig } from "./config.ts";
import { plan, scan, type ScanResult } from "./scan.ts";
import { decideWatch, fingerprint } from "./core/watch.ts";
import { importLegacy, pause, renderStatus, resume, status, type LegacyFile } from "./commands.ts";
import { defaultStateDir, Store } from "./store.ts";
import { tick } from "./tick.ts";

/** Default watch state file: ${XDG_STATE_HOME:-~/.local/state}/prflow/watch-<name>.txt. */
function watchStatePath(name: string): string {
  const base = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(base, "prflow", `watch-${name}.txt`);
}

/** A lock older than this belongs to a crashed or hung run and is taken over. */
const LOCK_STALE_MS = 30 * 60 * 1000;

/** Take an exclusive lock file; `false` if another live run holds it. */
function tryLock(path: string): boolean {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      closeSync(openSync(path, "wx"));
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      let age = 0;
      try {
        age = Date.now() - statSync(path).mtimeMs;
      } catch {
        continue; // Released between open and stat; retry.
      }
      if (age < LOCK_STALE_MS) return false;
      rmSync(path, { force: true });
    }
  }
  return false;
}

/** Write via a temp file and rename, so a crash never leaves a truncated state file. */
function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

const USAGE = `Usage: prflow <command> [options]

  scan           Fetch and print PR and worktree facts (read-only).
  plan           Classify each item and print the grouped report (read-only).
  watch          For schedulers: print the actionable report only when it
                 changed since the last watch run; print nothing otherwise.
                 Exit 1 on scan errors without saving state.
  tick           For schedulers: scan, reconcile, and report. Prints new
                 events since the last tick, then the report when it changed;
                 nothing when nothing happened. Exit 1 on failure.
  status         Print items, open dispatches, pauses, and the last tick.
  pause          Pause prflow (default, or --all) or one item (--item).
  resume         Resume prflow, one item (--item), or prflow and every
                 item (--all).
  import-legacy  Import the legacy automations' dispatched.txt files into the
                 ledger (idempotent; reads them only).
  config         Print the resolved accounts and where they came from.

Accounts come from the first of: --user; --config or PRFLOW_CONFIG;
<skill-dir>/config.json; \${XDG_CONFIG_HOME:-~/.config}/prflow/config.json;
the active gh account. See config.example.json.

Options:
  --config <path>            Config file (env PRFLOW_CONFIG)
  --user <login>             Use one account and ignore config files
  --owner <login>            Owner scope for --user or the active account, repeatable
  --repo <owner/repo>        Repo scope for --user or the active account, repeatable
  --format text|json         Output format
  --no-worktrees             Skip Orca worktree cleanup candidates
  --actionable               plan: drop waiting items; print nothing when none remain
  --name <name>              watch: state name, one per scheduled job (default: default)
  --state <path>             watch: state file (default:
                             \${XDG_STATE_HOME:-~/.local/state}/prflow/watch-<name>.txt)
  --state-dir <path>         tick, status, pause, resume, import-legacy: state
                             directory (default: \${XDG_STATE_HOME:-~/.local/state}/prflow)
  --item <owner/repo#N>      pause, resume: one item
  --all                      pause: the whole system; resume: the system and every item
  --reason <text>            pause: reason recorded in the event
  -h, --help                 Show this help`;

function scanLine(p: PrSnapshot): string {
  const s = summarizeChecks(p.checks);
  const unresolved = p.threads.filter((t) => !t.isResolved).length;
  const checks = `checks=${s.total}${s.pending ? " pending" : ""}${s.failed.length ? ` failed=${s.failed.length}` : ""}${s.cancelled.length ? ` cancelled=${s.cancelled.length}` : ""}`;
  return `${p.repo}#${p.number} ${p.role} account=${p.account} v=${version(p)} draft=${p.isDraft} merge=${p.mergeStateStatus} review=${p.reviewDecision ?? "NONE"} ${checks} unresolved=${unresolved} ${JSON.stringify(p.title)}`;
}

function renderScan(r: ScanResult): string {
  const lines = r.prs.map(scanLine);
  for (const w of r.worktrees)
    lines.push(`${w.repo}#${w.pr.number} worktree account=${w.account} pr=${w.pr.state} dirty=${w.dirtyFiles ?? "?"} ${w.path}`);
  return lines.join("\n") || "No PRs found.";
}

/** One watch run under a per-state-file lock. */
async function watch(statePath: string, runScan: () => Promise<ScanResult>): Promise<number> {
  mkdirSync(dirname(statePath), { recursive: true });
  const lock = `${statePath}.lock`;
  // Another run of this job is still going and will report; stay silent.
  if (!tryLock(lock)) return 0;
  try {
    const result = await runScan();
    const actionable = sortItems(plan(result)).filter((c) => c.kind !== "waiting");
    const report = actionable.length ? renderReport(actionable) : "";
    const d = decideWatch(readOrNull(statePath), fingerprint(actionable), report, result.errors);
    if (d.save !== null) writeAtomic(statePath, d.save);
    process.stdout.write(d.stdout);
    process.stderr.write(d.stderr);
    return d.exitCode;
  } finally {
    rmSync(lock, { force: true });
  }
}

const COMMANDS = ["scan", "plan", "watch", "tick", "status", "pause", "resume", "import-legacy", "config"];
const ITEM_KEY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+$/;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "text" },
      config: { type: "string" },
      owner: { type: "string", multiple: true },
      repo: { type: "string", multiple: true },
      user: { type: "string" },
      "no-worktrees": { type: "boolean", default: false },
      actionable: { type: "boolean", default: false },
      name: { type: "string", default: "default" },
      state: { type: "string" },
      "state-dir": { type: "string" },
      item: { type: "string" },
      all: { type: "boolean", default: false },
      reason: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const cmd = positionals[0] ?? "";
  if (values.help || !COMMANDS.includes(cmd)) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }
  const format = values.format;
  if (format !== "text" && format !== "json") throw new Error(`unknown --format ${format}`);
  if ((cmd === "watch" || cmd === "tick") && format !== "text") throw new Error(`${cmd} prints text only`);
  if (!/^[A-Za-z0-9_.-]+$/.test(values.name)) throw new Error("--name must use letters, digits, _ . -");
  if (values.item !== undefined && !ITEM_KEY.test(values.item)) throw new Error("--item must be owner/repo#number");
  if (values.item !== undefined && values.all) throw new Error("use --item or --all, not both");
  const stateDir = values["state-dir"] ?? defaultStateDir();
  const withStore = <T>(fn: (store: Store) => T): T => {
    const store = Store.open(stateDir);
    try {
      return fn(store);
    } finally {
      store.close();
    }
  };
  if (cmd === "status") {
    const s = withStore((store) => status(store, Date.now()));
    console.log(format === "json" ? JSON.stringify(s, null, 2) : renderStatus(s));
    return 0;
  }
  if (cmd === "pause" || cmd === "resume") {
    const target = { item: values.item, all: values.all };
    const reason = values.reason ?? "paused by prflow pause";
    console.log(withStore((store) => (cmd === "pause" ? pause(store, Date.now(), target, reason) : resume(store, Date.now(), target))));
    return 0;
  }
  if (cmd === "import-legacy") {
    const base = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
    const files: LegacyFile[] = (["pr-comment-watch", "pr-watch"] as const).map((source) => {
      const path = join(base, source, "dispatched.txt");
      return { source, path, text: readOrNull(path) };
    });
    console.log(withStore((store) => importLegacy(store, Date.now(), files)));
    return 0;
  }
  const deps = realDeps();
  const loaded = await loadConfig(
    {
      config: values.config ?? (process.env.PRFLOW_CONFIG || undefined),
      user: values.user,
      owners: values.owner,
      repos: values.repo,
    },
    deps.whoami,
  );
  const cfg = { ...loaded.config, worktrees: loaded.config.worktrees && !values["no-worktrees"] };
  deps.setChildTimeout(cfg.rails.childTimeoutSeconds * 1000);
  if (cmd === "config") {
    if (format === "json") console.log(JSON.stringify({ source: loaded.source, ...cfg }, null, 2));
    else {
      console.log(`source: ${loaded.source}`);
      for (const a of cfg.accounts) {
        const scope = [...a.owners.map((o) => `owner:${o}`), ...a.repos.map((r) => `repo:${r}`)];
        console.log(`account ${a.login}: ${scope.join(" ") || "every repo"}`);
      }
    }
    return 0;
  }
  if (cmd === "tick") {
    const store = Store.open(stateDir);
    try {
      const out = await tick(deps, store, cfg, { dryRun: true });
      process.stdout.write(out.stdout);
      process.stderr.write(out.stderr);
      return out.exitCode;
    } finally {
      store.close();
    }
  }
  if (cmd === "watch") return watch(values.state ?? watchStatePath(values.name), () => scan(deps, cfg));
  const result = await scan(deps, cfg);
  for (const e of result.errors) console.error(`warn: ${e}`);
  if (cmd === "scan") {
    console.log(format === "json" ? JSON.stringify(result, null, 2) : renderScan(result));
    return 0;
  }
  const all = sortItems(plan(result));
  const items = values.actionable ? all.filter((c) => c.kind !== "waiting") : all;
  if (format === "json") console.log(JSON.stringify(items, null, 2));
  else if (!values.actionable || items.length) console.log(renderReport(items));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`prflow: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
