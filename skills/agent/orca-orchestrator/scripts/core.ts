/**
 * Pure parts of the orca-orchestrator precheck: feed text, due dispatches,
 * repeated-failure suppression, and pruning. No I/O.
 */

/** One child tool run by the precheck. */
export interface ToolRun {
  /** Section title, such as `repo-sync` or `prflow watch`. */
  name: string;
  /** Exit code; `null` when the tool was still running at the deadline or could not start. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Spawn error, when the tool could not start. */
  error?: string;
  /** Files that hold the full output. */
  outPath: string;
  errPath: string;
}

/** An open prflow dispatch that needs `prflow tick` now. */
export interface DueDispatch {
  id: number;
  item: string;
  kind: string;
  state: string;
  sessionHandle: string | null;
  leaseUntil: number | null;
}

/** A tool failure for the feed. `signature` identifies a repeat of the same failure. */
export interface Failure {
  signature: string;
  text: string;
}

/** When each failure signature was last reported (ms). */
export type FailureMemory = Record<string, number>;

/** Identical failures are reported again only after this long. */
export const REPEAT_WINDOW_MS = 60 * 60 * 1000;

const STDERR_LINES = 20;

/** `2026-11-20T20-30-00-000Z`: an ISO time that sorts by name and is safe as a file name. */
export const stamp = (d: Date): string => d.toISOString().replace(/[:.]/g, "-");

const lastLines = (s: string, n: number): string => s.trimEnd().split("\n").slice(-n).join("\n");
const firstLine = (s: string): string => s.trim().split("\n")[0] ?? "";
const indent = (s: string): string => s.split("\n").map((l) => `  ${l}`).join("\n");

/** The failure of one tool run, or `null` when it succeeded. */
export function failureOf(r: ToolRun): Failure | null {
  if (r.exitCode === 0 && !r.timedOut && !r.error) return null;
  if (r.error) return { signature: `${r.name}|error|${r.error}`, text: `- ${r.name} could not start: ${r.error}` };
  if (r.timedOut)
    return {
      signature: `${r.name}|timeout`,
      text: `- ${r.name} was still running at the precheck deadline; it was left to finish. Output so far: ${r.outPath}, errors: ${r.errPath}`,
    };
  const err = lastLines(r.stderr, STDERR_LINES) || "(no stderr)";
  return {
    signature: `${r.name}|exit ${r.exitCode}|${firstLine(r.stderr)}`,
    text: `- ${r.name} exited ${r.exitCode ?? "abnormally"}. Full errors: ${r.errPath}\n${indent(err)}`,
  };
}

/**
 * Drop failures already reported within `windowMs`, so a persistent failure
 * does not start an agent run every tick. A failure that stopped happening is
 * forgotten, so its return is reported at once.
 */
export function filterRepeats(failures: Failure[], memory: FailureMemory, now: number, windowMs = REPEAT_WINDOW_MS): { report: Failure[]; memory: FailureMemory } {
  const next: FailureMemory = {};
  const report: Failure[] = [];
  for (const f of failures) {
    const last = memory[f.signature];
    if (last !== undefined && now - last < windowMs) {
      next[f.signature] = last;
      continue;
    }
    next[f.signature] = now;
    report.push(f);
  }
  return { report, memory: next };
}

/**
 * Open dispatches from `prflow status --format json` that only `prflow tick`
 * can move: no lease (planned, waiting on a busy session) or a lease that has
 * expired. Throws on output that is not prflow status JSON.
 */
export function dueDispatches(statusJson: string, now: number): DueDispatch[] {
  const s = JSON.parse(statusJson) as { openDispatches?: unknown };
  if (!Array.isArray(s.openDispatches)) throw new Error("prflow status: no openDispatches in the reply");
  const out: DueDispatch[] = [];
  for (const raw of s.openDispatches as Record<string, unknown>[]) {
    const lease = typeof raw.leaseUntil === "number" ? raw.leaseUntil : null;
    if (lease !== null && lease > now) continue;
    out.push({
      id: Number(raw.id),
      item: String(raw.item ?? ""),
      kind: String(raw.kind ?? ""),
      state: String(raw.state ?? ""),
      sessionHandle: typeof raw.sessionHandle === "string" ? raw.sessionHandle : null,
      leaseUntil: lease,
    });
  }
  return out;
}

export interface FeedInput {
  at: Date;
  /** Successful tool runs; their stdout becomes a section when non-empty. */
  runs: ToolRun[];
  due: DueDispatch[];
  failures: Failure[];
}

/** The feed text, or `""` when there is nothing to read. */
export function composeFeed(f: FeedInput): string {
  const sections: string[] = [];
  for (const r of f.runs) {
    const body = r.exitCode === 0 && !r.timedOut ? r.stdout.trim() : "";
    if (body) sections.push(`## ${r.name}\n\n${body}`);
  }
  if (f.due.length) {
    const rows = f.due.map((d) => `- ${d.item} ${d.kind} #${d.id} | ${d.state} | session ${d.sessionHandle ?? "none"} | ${d.leaseUntil === null ? "no lease" : `lease expired ${new Date(d.leaseUntil).toISOString()}`}`);
    sections.push(`## prflow dispatches due (${f.due.length})\n\n${rows.join("\n")}\n\nnext: run \`prflow tick\` in this run; the precheck cannot message sessions.`);
  }
  if (f.failures.length) sections.push(`## Failures (${f.failures.length})\n\n${f.failures.map((x) => x.text).join("\n")}`);
  if (!sections.length) return "";
  return `# orca-orchestrator feed ${f.at.toISOString()}\n\n${sections.join("\n\n")}\n`;
}

/** Entries to delete so only the newest `keep` remain (names sort by time). */
export function pruneList(names: readonly string[], keep: number): string[] {
  const sorted = [...names].sort();
  return keep >= sorted.length ? [] : sorted.slice(0, sorted.length - keep);
}
