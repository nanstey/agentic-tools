#!/usr/bin/env node
import { parseArgs } from "node:util";
import { legacyLine, summarizeChecks, version } from "./core/classify.ts";
import { renderReport, sortItems } from "./core/report.ts";
import type { PrSnapshot } from "./core/types.ts";
import { realDeps } from "./deps.ts";
import { DEFAULT_CONFIG, plan, scan, type Config, type ScanResult } from "./scan.ts";

const USAGE = `Usage: prflow <scan|plan> [options]

  scan   Fetch and print PR and worktree facts (read-only).
  plan   Classify each item and print the grouped report (read-only).

Options:
  --format text|json|legacy  Output format (legacy: plan only, precheck.sh lines)
  --owner <login>            Owner in scope, repeatable (default: Checkfront)
  --all-owners               No owner filter (legacy precheck scope)
  --me <login>               GitHub account (default: noelcf)
  --no-worktrees             Skip Orca worktree cleanup candidates
  -h, --help                 Show this help`;

function scanLine(p: PrSnapshot): string {
  const s = summarizeChecks(p.checks);
  const unresolved = p.threads.filter((t) => !t.isResolved).length;
  const checks = `checks=${s.total}${s.pending ? " pending" : ""}${s.failed.length ? ` failed=${s.failed.length}` : ""}${s.cancelled.length ? ` cancelled=${s.cancelled.length}` : ""}${s.checkerFailed.length ? " checker-failed" : ""}`;
  return `${p.repo}#${p.number} ${p.role} v=${version(p)} draft=${p.isDraft} merge=${p.mergeStateStatus} review=${p.reviewDecision ?? "NONE"} ${checks} unresolved=${unresolved} ${JSON.stringify(p.title)}`;
}

function renderScan(r: ScanResult): string {
  const lines = r.prs.map(scanLine);
  for (const w of r.worktrees)
    lines.push(`${w.repo}#${w.pr.number} worktree pr=${w.pr.state} dirty=${w.dirtyFiles ?? "?"} ${w.path}`);
  return lines.join("\n") || "No PRs found.";
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "text" },
      owner: { type: "string", multiple: true },
      "all-owners": { type: "boolean", default: false },
      me: { type: "string", default: DEFAULT_CONFIG.me },
      "no-worktrees": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const cmd = positionals[0];
  if (values.help || (cmd !== "scan" && cmd !== "plan")) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }
  const format = values.format;
  if (format !== "text" && format !== "json" && format !== "legacy") throw new Error(`unknown --format ${format}`);
  if (format === "legacy" && cmd !== "plan") throw new Error("--format legacy applies to plan only");
  const cfg: Config = {
    ...DEFAULT_CONFIG,
    me: values.me,
    owners: values["all-owners"] ? [] : (values.owner ?? DEFAULT_CONFIG.owners),
    worktrees: !values["no-worktrees"],
  };
  const result = await scan(await realDeps(cfg.me), cfg);
  for (const e of result.errors) console.error(`warn: ${e}`);
  if (cmd === "scan") {
    console.log(format === "json" ? JSON.stringify(result, null, 2) : renderScan(result));
    return 0;
  }
  const items = sortItems(plan(result, cfg));
  if (format === "json") console.log(JSON.stringify(items, null, 2));
  else if (format === "legacy") {
    const lines = result.prs.filter((p) => p.role === "author").flatMap((p) => {
      const c = items.find((i) => i.key === `${p.repo}#${p.number}`);
      return (c?.triggers ?? []).map((t) => legacyLine(p, t));
    });
    if (lines.length) console.log(lines.join("\n"));
  } else console.log(renderReport(items));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(`prflow: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
