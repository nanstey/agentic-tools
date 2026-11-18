#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { legacyLine, summarizeChecks, version } from "./core/classify.ts";
import { renderReport, sortItems } from "./core/report.ts";
import type { PrSnapshot } from "./core/types.ts";
import { realDeps } from "./deps.ts";
import { loadConfig } from "./config.ts";
import { plan, scan, type ScanResult } from "./scan.ts";
import { decideWatch, fingerprint } from "./core/watch.ts";

/** Default watch state file: ${XDG_STATE_HOME:-~/.local/state}/prflow/watch-<name>.txt. */
function watchStatePath(name: string): string {
  const base = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(base, "prflow", `watch-${name}.txt`);
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

const USAGE = `Usage: prflow <scan|plan|watch|config> [options]

  scan    Fetch and print PR and worktree facts (read-only).
  plan    Classify each item and print the grouped report (read-only).
  watch   For schedulers: print the actionable report only when it changed
          since the last watch run; print nothing otherwise. Exit 1 on scan
          errors without saving state.
  config  Print the resolved accounts and where they came from.

Accounts come from the first of: --user; --config or PRFLOW_CONFIG;
<skill-dir>/config.json; \${XDG_CONFIG_HOME:-~/.config}/prflow/config.json;
the active gh account. See config.example.json.

Options:
  --config <path>            Config file (env PRFLOW_CONFIG)
  --user <login>             Use one account and ignore config files
  --owner <login>            Owner scope for --user or the active account, repeatable
  --repo <owner/repo>        Repo scope for --user or the active account, repeatable
  --format text|json|legacy  Output format (legacy: plan only, precheck.sh lines)
  --no-worktrees             Skip Orca worktree cleanup candidates
  --actionable               plan: drop waiting items; print nothing when none remain
  --name <name>              watch: state name, one per scheduled job (default: default)
  --state <path>             watch: state file (default:
                             \${XDG_STATE_HOME:-~/.local/state}/prflow/watch-<name>.txt)
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
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const cmd = positionals[0];
  if (values.help || (cmd !== "scan" && cmd !== "plan" && cmd !== "watch" && cmd !== "config")) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }
  const format = values.format;
  if (format !== "text" && format !== "json" && format !== "legacy") throw new Error(`unknown --format ${format}`);
  if (format === "legacy" && cmd !== "plan") throw new Error("--format legacy applies to plan only");
  if (cmd === "watch" && format !== "text") throw new Error("watch prints text only");
  if (!/^[A-Za-z0-9_.-]+$/.test(values.name)) throw new Error("--name must use letters, digits, _ . -");
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
  const result = await scan(deps, cfg);
  if (cmd === "watch") {
    const actionable = sortItems(plan(result)).filter((c) => c.kind !== "waiting");
    const report = actionable.length ? renderReport(actionable) : "";
    const statePath = values.state ?? watchStatePath(values.name);
    const d = decideWatch(readOrNull(statePath), fingerprint(actionable), report, result.errors);
    if (d.save !== null) {
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath, d.save);
    }
    process.stdout.write(d.stdout);
    process.stderr.write(d.stderr);
    return d.exitCode;
  }
  for (const e of result.errors) console.error(`warn: ${e}`);
  if (cmd === "scan") {
    console.log(format === "json" ? JSON.stringify(result, null, 2) : renderScan(result));
    return 0;
  }
  const all = sortItems(plan(result));
  const items = values.actionable ? all.filter((c) => c.kind !== "waiting") : all;
  if (format === "json") console.log(JSON.stringify(items, null, 2));
  else if (format === "legacy") {
    const lines = result.prs.filter((p) => p.role === "author").flatMap((p) => {
      const c = items.find((i) => i.key === `${p.repo}#${p.number}`);
      return (c?.triggers ?? []).map((t) => legacyLine(p, t));
    });
    if (lines.length) console.log(lines.join("\n"));
  } else if (!values.actionable || items.length) console.log(renderReport(items));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`prflow: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
