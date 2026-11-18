/**
 * `prflow watch`: change detection for any scheduler (cron, systemd timers, agent
 * schedulers). Pure; the CLI reads and writes the state file.
 */
import type { Classification } from "./types.ts";

export interface WatchDecision {
  /** Text for stdout; empty means stay silent. */
  stdout: string;
  /** New state to save, or `null` to keep the old state. */
  save: string | null;
  stderr: string;
  exitCode: number;
}

/**
 * One line per actionable item: key, kind, version, and trigger details. Live
 * status text (pending checks, merge state, dirty counts) is left out, so it
 * changing alone does not re-announce the report.
 */
export function fingerprint(items: Classification[]): string {
  return items
    .map((c) => [c.key, c.kind, c.version, ...c.triggers.map((t) => `${t.kind}:${t.detail ?? ""}`)].join(" "))
    .sort()
    .join("\n");
}

/**
 * Print `report` only when the fingerprint differs from `previous` (the saved
 * fingerprint, `null` on the first run). Scan errors fail the run without
 * saving, because a partial scan could drop items and announce them again later.
 */
export function decideWatch(previous: string | null, current: string, report: string, errors: string[]): WatchDecision {
  if (errors.length)
    return { stdout: "", save: null, stderr: `prflow scan incomplete:\n${errors.map((e) => `warn: ${e}`).join("\n")}\n`, exitCode: 1 };
  if (current === (previous ?? "")) return { stdout: "", save: previous === null ? current : null, stderr: "", exitCode: 0 };
  return { stdout: report ? `${report}\n` : "", save: current, stderr: "", exitCode: 0 };
}
