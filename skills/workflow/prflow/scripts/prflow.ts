#!/usr/bin/env node
import { closeSync, mkdirSync, openSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { readOrNull } from "../../../../lib/runtime.ts";
import { summarizeChecks, version } from "./core/classify.ts";
import { renderPlanJson, renderReport, sortItems } from "./core/report.ts";
import { accountFor } from "./core/config.ts";
import type { PrSnapshot } from "./core/types.ts";
import { parsePr, prArgs } from "./adapters/gh.ts";
import { realDeps, type RealDeps } from "./deps.ts";
import type { DraftMeta } from "./core/draft.ts";
import { makeReviewFlow } from "./review.ts";
import { listDrafts, renderDraftList, showDraft } from "./review-cmd.ts";
import { plan, scan, type ScanResult } from "./scan.ts";
import { decideWatch, fingerprint } from "./core/watch.ts";
import { importLegacy, pause, recover, renderStatus, resume, status, type LegacyFile } from "./commands.ts";
import { defaultStateDir, Store } from "./store.ts";
import { tick } from "./tick.ts";
import { makeAct, makeVerify } from "./actions.ts";
import { makeUnblock } from "./unblock.ts";
import { makeWorktreeStatus } from "./worktree-status.ts";
import { loadTemplates, makeAgentFlow } from "./agents.ts";
import { loadConfig, SKILL_DIR } from "./config.ts";

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

const USAGE = `Usage: prflow <command> [options]

  scan           Fetch and print PR and worktree facts (read-only).
  plan           Classify each item and print the grouped report (read-only).
  watch          For schedulers: print the actionable report only when it
                 changed since the last watch run; print nothing otherwise.
                 Exit 1 on scan errors without saving state.
  tick           For schedulers: scan, reconcile, act, and report. Prints new
                 events since the last tick, then the report when it changed;
                 nothing when nothing happened. Exit 1 on failure. Actions
                 (worktree cleanup) run only when the config sets
                 "actions": {"dryRun": false}; Pi dispatch (ci, comments,
                 behind briefs) only when it sets "dispatch": {"dryRun":
                 false}; reviewer sessions (review-requested) only when it
                 sets "review": {"dryRun": false}; worktree board column
                 moves only when it sets "worktreeStatus": {"dryRun": false}.
                 Otherwise they are announced. Tick never posts to GitHub.
  status         Print items, open dispatches, pauses, and the last tick.
  pause          Pause prflow (default, or --all) or one item (--item).
  resume         Resume prflow, one item (--item), or prflow and every
                 item (--all).
  recover <id>   Give one dispatch a fresh start: mark it stale (or reopen it
                 when failed, stale, or abandoned), reset its attempts and the
                 item's loop breaker count, and lift a pause it caused. The
                 next tick retries it while the PR still needs that work.
  review list    List saved review drafts.
  review show <draft-id>
                 Print one saved draft and its GitHub-derived posted status.
  import-legacy  Import the legacy automations' dispatched.txt files into the
                 ledger (idempotent; reads them only).
  config         Print the resolved accounts and where they came from.

Accounts come from the first of: --user; --config or AGENTIC_TOOLS_CONFIG;
<repo-root>/config.json; \${XDG_CONFIG_HOME:-~/.config}/agentic-tools/config.json;
the active gh account. See <repo-root>/config.example.json.

Options:
  --config <path>            Config file (env AGENTIC_TOOLS_CONFIG)
  --user <login>             Use one account and ignore config files
  --owner <login>            Owner scope for --user or the active account, repeatable
  --repo <owner/repo>        Repo scope for --user or the active account, repeatable
  --format text|json         Output format
  --no-worktrees             Skip Orca worktree cleanup candidates
  --actionable               plan: drop waiting items; print nothing when none remain
  --name <name>              watch: state name, one per scheduled job (default: default)
  --state <path>             watch: state file (default:
                             \${XDG_STATE_HOME:-~/.local/state}/prflow/watch-<name>.txt)
  --state-dir <path>         tick, status, pause, resume, recover, import-legacy: state
                             directory (default: \${XDG_STATE_HOME:-~/.local/state}/prflow)
  --item <owner/repo#N>      pause, resume: one item
  --all                      pause: the whole system; resume: the system and every item
  --reason <text>            pause: reason recorded in the event
  --dry-run                  tick: announce actions, Pi dispatches, reviewer
                             sessions, and worktree column moves without running
                             them, even when the config enables them
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

const COMMANDS = ["scan", "plan", "watch", "tick", "status", "pause", "resume", "recover", "review", "import-legacy", "config"];
const readDraftPr = (deps: RealDeps) => async (meta: DraftMeta) => {
  const r = await deps.gh(meta.account, prArgs(meta.repo, meta.number));
  if (!r.ok) throw new Error(`cannot read ${meta.item}: ${r.stderr.trim()}`);
  const pr = parsePr(r.stdout, meta.repo, meta.number, "reviewer", meta.account);
  if (!pr) throw new Error(`cannot read ${meta.item}: PR not found`);
  return pr;
};
const ITEM_KEY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+$/;

async function main(argv: string[]): Promise<number> {
  if (argv[0] === "review" && argv[1] === "post") {
    console.error("unknown command: prflow review post");
    return 2;
  }
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
      "dry-run": { type: "boolean", default: false },
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
  /**
   * Expected draft account per repo from the shared config. Without a readable
   * config, drafts are listed without the account check, and a warning says so.
   */
  const draftAccounts = async (deps: RealDeps): Promise<((repo: string) => string | null) | undefined> => {
    try {
      const loaded = await loadConfig({ config: values.config ?? (process.env.AGENTIC_TOOLS_CONFIG || undefined), user: values.user, owners: values.owner, repos: values.repo }, deps.whoami);
      return (repo) => accountFor(loaded.config, repo)?.login ?? null;
    } catch (e) {
      console.error(`prflow: config unavailable, draft accounts not checked: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };
  if (cmd === "status") {
    const s = withStore((store) => status(store, Date.now()));
    console.log(format === "json" ? JSON.stringify(s, null, 2) : renderStatus(s));
    return 0;
  }
  if (cmd === "recover") {
    const id = positionals[1] ?? "";
    if (!/^[1-9]\d{0,9}$/.test(id) || positionals.length !== 2) throw new Error("usage: prflow recover <dispatchId>");
    console.log(withStore((store) => recover(store, Date.now(), Number(id))));
    return 0;
  }
  if (cmd === "pause" || cmd === "resume") {
    const target = { item: values.item, all: values.all };
    const reason = values.reason ?? "paused by prflow pause";
    console.log(withStore((store) => (cmd === "pause" ? pause(store, Date.now(), target, reason) : resume(store, Date.now(), target))));
    return 0;
  }
  if (cmd === "review") {
    const sub = positionals[1] ?? "";
    const id = positionals[2] ?? "";
    if (sub === "list" && positionals.length === 2) {
      const deps = realDeps();
      const expected = await draftAccounts(deps);
      const rows = await withStore((store) => listDrafts(store, readDraftPr(deps), expected));
      console.log(format === "json" ? JSON.stringify(rows, null, 2) : renderDraftList(rows));
      return 0;
    }
    if (sub === "show" && positionals.length === 3) {
      const deps = realDeps();
      const expected = await draftAccounts(deps);
      console.log(await withStore((store) => showDraft(store, id, readDraftPr(deps), expected)));
      return 0;
    }
    throw new Error("unknown command: prflow review " + sub + "; usage: prflow review list | show <draft-id>");
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
      config: values.config ?? (process.env.AGENTIC_TOOLS_CONFIG || undefined),
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
      const dryRun = values["dry-run"] || cfg.actions.dryRun;
      const dispatchDryRun = values["dry-run"] || cfg.dispatch.dryRun;
      const reviewDryRun = values["dry-run"] || cfg.review.dryRun;
      const worktreeStatusDryRun = values["dry-run"] || cfg.worktreeStatus.dryRun;
      const safe = makeAct(deps, store);
      const unblock = makeUnblock(deps, store, cfg);
      const columns = makeWorktreeStatus(deps, store, cfg);
      const templates = loadTemplates(join(SKILL_DIR, "templates", "briefs"));
      const agents = makeAgentFlow(deps, store, cfg, templates);
      const reviews = makeReviewFlow(deps, store, cfg, templates);
      const out = await tick(deps, store, cfg, { dryRun, dispatchDryRun, reviewDryRun, worktreeStatusDryRun }, {
        monitor: async (...a) => {
          await agents.monitor(...a);
          await reviews.monitor(...a);
        },
        verify: makeVerify(cfg.worktrees),
        act: async (...a) => {
          await safe(...a);
          await unblock(a[0], a[3]);
          await agents.act(...a);
          await reviews.act(...a);
          await columns(a[0], a[1], a[3]);
        },
        annotate: reviews.annotate,
      });
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
  if (format === "json") console.log(renderPlanJson(items));
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
