/**
 * `prflow watch`: change detection for any scheduler (cron, systemd timers, agent
 * schedulers). Pure; the CLI reads and writes the state file.
 */

export interface WatchDecision {
  /** Text for stdout; empty means stay silent. */
  stdout: string;
  /** New state to save, or `null` to keep the old state. */
  save: string | null;
  stderr: string;
  exitCode: number;
}

/**
 * Print `report` only when it differs from `previous` (the last saved report,
 * `null` on the first run). Scan errors fail the run without saving, because a
 * partial scan could drop items and announce them again on the next run.
 */
export function decideWatch(previous: string | null, report: string, errors: string[]): WatchDecision {
  if (errors.length)
    return { stdout: "", save: null, stderr: `prflow scan incomplete:\n${errors.map((e) => `warn: ${e}`).join("\n")}\n`, exitCode: 1 };
  if (report === (previous ?? "")) return { stdout: "", save: previous === null ? report : null, stderr: "", exitCode: 0 };
  return { stdout: report ? `${report}\n` : "", save: report, stderr: "", exitCode: 0 };
}
