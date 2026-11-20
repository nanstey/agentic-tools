/** State transitions and output text. Pure, no I/O. */
import type { Event, LastRun, RepoResult, RepoState } from "./types.ts";

/** A result the scheduler should print this run. */
export interface Notice {
  kind: "failure" | "stuck";
  result: RepoResult;
  streak: number;
}

/** Skips print once they persist for this many consecutive runs. */
export const STUCK_RUNS = 2;

/** Failures print on their first run: fetch failures, failed merges, and unreadable checkouts. */
const isFailure = (r: RepoResult) => r.status === "failed" || r.reason === "fetch-failed";

/**
 * Next state and the notices to print. A skip or failure extends the streak
 * while its status and reason stay the same. Each streak prints at most once:
 * failures on their first run, other skips once they reach `STUCK_RUNS`.
 * Repos missing from this run are dropped.
 */
export function nextState(prev: LastRun | null, results: RepoResult[], at: string): { state: LastRun; notices: Notice[] } {
  const repos: Record<string, RepoState> = {};
  const notices: Notice[] = [];
  for (const r of results) {
    const old = prev?.repos[r.path];
    const entry: RepoState = { name: r.name, slug: r.slug, status: r.status, streak: 0, reported: false, at };
    if (r.reason) entry.reason = r.reason;
    if (r.detail) entry.detail = r.detail;
    if (r.commits !== undefined) entry.commits = r.commits;
    if (r.status === "skipped" || r.status === "failed") {
      const same = old && old.status === r.status && old.reason === r.reason;
      entry.streak = same ? old.streak + 1 : 1;
      entry.reported = same ? old.reported : false;
      const due = isFailure(r) ? true : entry.streak >= STUCK_RUNS;
      if (due && !entry.reported) {
        notices.push({ kind: isFailure(r) ? "failure" : "stuck", result: r, streak: entry.streak });
        entry.reported = true;
      }
    }
    repos[r.path] = entry;
  }
  return { state: { version: 1, at, repos }, notices };
}

/** Events for `events.jsonl`: every pull, the first run of each skip or failure streak, and a run summary. */
export function runEvents(state: LastRun, results: RepoResult[], at: string): Event[] {
  const events: Event[] = [];
  const counts = { updated: 0, upToDate: 0, skipped: 0, failed: 0 };
  for (const r of results) {
    if (r.status === "updated") counts.updated++;
    else if (r.status === "up-to-date") counts.upToDate++;
    else if (r.status === "skipped") counts.skipped++;
    else if (r.status === "failed") counts.failed++;
    const base = { at, repo: r.name, path: r.path };
    if (r.status === "updated") events.push({ ...base, kind: "updated", from: r.from, to: r.to, commits: r.commits });
    else if ((r.status === "skipped" || r.status === "failed") && state.repos[r.path]?.streak === 1)
      events.push({ ...base, kind: r.status, reason: r.reason, detail: r.detail });
  }
  events.push({ at, kind: "run", counts });
  return events;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const short = (sha: string | undefined) => (sha ?? "").slice(0, 7);

function noticeLine(n: Notice): string {
  const r = n.result;
  const detail = r.detail ? `: ${r.detail}` : "";
  if (n.kind === "stuck") {
    const hint = r.reason === "not-on-default" ? " (if origin's default branch changed: git remote set-head origin --auto)" : "";
    return `${r.name}: skipped (${r.reason}) for ${plural(n.streak, "run")}${detail}${hint}`;
  }
  if (r.reason === "fetch-failed") return `${r.name}: fetch failed${detail}`;
  if (r.reason === "merge-failed") return `${r.name}: merge failed${detail}`;
  if (r.reason === "merge-interrupted") return `${r.name}: merge interrupted${detail}`;
  return `${r.name}: error${detail}`;
}

/** New commits in a reported repo: one-line log (max 10) and changed paths (max 15). */
export function changeBlock(r: RepoResult): string {
  const n = r.commits ?? 0;
  const lines = [`${r.name}: pulled ${plural(n, "commit")} on ${r.branch} (${short(r.from)}..${short(r.to)})`];
  const log = r.log ?? [];
  for (const l of log) lines.push(`  ${l}`);
  if (n > log.length) lines.push(`  ... and ${n - log.length} more`);
  const paths = r.paths ?? [];
  const total = r.totalPaths ?? paths.length;
  lines.push(`  changed paths (${total}):`);
  for (const p of paths) lines.push(`    ${p}`);
  if (total > paths.length) lines.push(`    ... and ${total - paths.length} more`);
  return lines.join("\n");
}

/**
 * Scheduler output: failures, then stuck checkouts, then reported pulls.
 * Empty when nothing needs attention.
 */
export function renderRun(notices: Notice[], results: RepoResult[]): string {
  const failures = notices.filter((n) => n.kind === "failure").map(noticeLine);
  const stuck = notices.filter((n) => n.kind === "stuck").map(noticeLine);
  const changes = results.filter((r) => r.status === "updated" && r.log).map(changeBlock);
  const sections = [failures.join("\n"), stuck.join("\n"), ...changes].filter(Boolean);
  return sections.length ? `${sections.join("\n\n")}\n` : "";
}

function describe(r: { status: string; reason?: string; detail?: string; commits?: number }, dryRun: boolean): string {
  if (r.status === "would-update") return `would-update  ${r.commits} behind as of last fetch`;
  if (r.status === "updated") return `updated  ${plural(r.commits ?? 0, "commit")}`;
  if (r.status === "skipped" || r.status === "failed") return `${r.status} (${r.reason})${r.detail ? `  ${r.detail}` : ""}`;
  return dryRun ? `${r.status} as of last fetch` : r.status;
}

/** Human report for `run --dry-run`: one line per repo. */
export function renderDryRun(results: RepoResult[], paused: boolean): string {
  const width = Math.max(0, ...results.map((r) => r.name.length));
  const lines = ["repo-sync dry run: no fetch, no merge, no state written"];
  if (paused) lines.push("note: repo-sync is paused; a scheduled run would do nothing");
  for (const r of results) lines.push(`${r.name.padEnd(width)}  ${describe(r, true)}  [${r.auth}]`);
  if (!results.length) lines.push("no tracked git repos");
  return `${lines.join("\n")}\n`;
}

/** `repo-sync status`: the last run per repo. */
export function renderStatus(last: LastRun | null, paused: string | null): string {
  const lines: string[] = [];
  if (paused !== null) lines.push(`paused${paused ? `: ${paused}` : ""}`);
  if (!last) {
    lines.push("no runs yet");
    return `${lines.join("\n")}\n`;
  }
  lines.push(`last run: ${last.at}`);
  const entries = Object.values(last.repos);
  const width = Math.max(0, ...entries.map((e) => e.name.length));
  for (const e of entries) {
    const streak = e.streak > 1 ? `  (${e.streak} runs)` : "";
    lines.push(`${e.name.padEnd(width)}  ${describe(e, false)}${streak}`);
  }
  return `${lines.join("\n")}\n`;
}
