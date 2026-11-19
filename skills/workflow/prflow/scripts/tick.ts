/**
 * `prflow tick`: scan, reconcile, act, report. stdout is the feed the scheduler
 * delivers: new events since the last tick, then the grouped report when it
 * changed. Empty when nothing happened. Exit 1 on failure.
 */
import type { Config } from "./core/config.ts";
import { renderEvent } from "./core/events.ts";
import { backoffMs } from "./core/rails.ts";
import { renderTickReport } from "./core/report.ts";
import { sortItems } from "./core/report.ts";
import type { Classification } from "./core/types.ts";
import { fingerprint } from "./core/watch.ts";
import { reconcile, type TickContext } from "./dispatch.ts";
import { plan, scan, type Deps, type ScanResult } from "./scan.ts";
import type { Dispatch, ItemRow, Store } from "./store.ts";

export interface TickDeps extends Deps {
  /** Milliseconds since the epoch. */
  now(): number;
}

export interface TickOptions {
  /** No external side effects; actions are only announced. */
  dryRun: boolean;
}

export interface TickOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Meta keys. */
export const META = {
  eventsOffset: "events_offset",
  reportFp: "report_fp",
  failures: "failures",
  nextTickAt: "next_tick_at",
  lastScanAt: "last_scan_at",
} as const;

/** Reject when `p` takes longer than `ms`. */
export function withBudget<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} exceeded its ${Math.round(ms / 1000)}s budget`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16) + "Z";

export function inFlightRow(d: Dispatch): string {
  const lease = d.leaseUntil !== null ? ` | lease until ${hhmm(d.leaseUntil)}` : "";
  const session = d.sessionHandle ? ` | session ${d.sessionHandle}` : "";
  return `- ${d.item} ${d.kind} #${d.id} ${d.state} | attempt ${d.attempts}${lease}${session}`;
}

export function pausedRow(i: ItemRow): string {
  return `- ${i.key} paused: ${i.pausedReason ?? "no reason"} | next: \`prflow resume --item ${i.key}\` when resolved | owner: you`;
}

/** Report text and its change fingerprint. Lease times are left out of the fingerprint. */
export function tickReport(actionable: Classification[], open: Dispatch[], paused: ItemRow[]) {
  const text = renderTickReport(actionable, {
    inFlight: open.map(inFlightRow),
    paused: paused.map(pausedRow),
  });
  const fp = [
    fingerprint(actionable),
    ...open.map((d) => `dispatch ${d.id} ${d.state} ${d.attempts}`),
    ...paused.map((i) => `paused ${i.key.toLowerCase()} ${i.pausedReason ?? ""}`),
  ]
    .filter(Boolean)
    .join("\n");
  return { text, fp };
}

/** Actions run after reconcile. Phase 2 has none; later phases plug in here. */
export type Act = (ctx: TickContext, result: ScanResult, items: Classification[], opts: TickOptions) => Promise<void>;

/** Settle open dispatches from fresh facts before leases are checked. */
export type Verify = Parameters<typeof reconcile>[2];

export async function tick(
  deps: TickDeps,
  store: Store,
  cfg: Config,
  opts: TickOptions,
  hooks: { act?: Act; verify?: (result: ScanResult) => Verify } = {},
): Promise<TickOutput> {
  const quiet: TickOutput = { stdout: "", stderr: "", exitCode: 0 };
  // A paused prflow does nothing: no scan, no run row, no output. Events wait
  // for the first tick after `prflow resume`.
  if (store.systemPaused() !== null) return quiet;
  const start = deps.now();
  const nextAt = Number(store.getMeta(META.nextTickAt) ?? 0);
  // Backing off after failed ticks: the failure was already reported.
  if (start < nextAt) return quiet;
  // Another tick is still running and will report.
  if (!store.tryLock(start)) return quiet;
  const runId = store.startRun(start, opts.dryRun);
  try {
    const result = await withBudget(scan(deps, cfg), cfg.rails.pollBudgetSeconds * 1000, "scan");
    if (result.errors.length) throw new Error(`scan incomplete:\n${result.errors.map((e) => `warn: ${e}`).join("\n")}`);
    const now = deps.now();
    const items = plan(result);
    store.upsertItems(items, now);
    store.setMeta(META.lastScanAt, String(now));
    const ctx: TickContext = { now, tickId: runId, rails: cfg.rails, starts: 0 };
    reconcile(store, ctx, hooks.verify?.(result));
    if (hooks.act) await hooks.act(ctx, result, items, opts);

    const actionable = sortItems(items).filter((c) => c.kind !== "waiting");
    const report = tickReport(actionable, store.openDispatches(), store.pausedItems());
    const prevFp = store.getMeta(META.reportFp);
    const changed = report.fp !== (prevFp ?? "");
    const { events, offset } = store.readEventsFrom(Number(store.getMeta(META.eventsOffset) ?? 0));
    const parts: string[] = [];
    if (events.length) parts.push(`## New events (${events.length})`, ...events.map(renderEvent), "");
    if (changed && prevFp !== null) parts.push(report.text || "Nothing to report.");
    else if (changed && report.text) parts.push(report.text);
    store.setMeta(META.eventsOffset, String(offset));
    store.setMeta(META.reportFp, report.fp);
    store.setMeta(META.failures, "0");
    store.setMeta(META.nextTickAt, "0");
    store.finishRun(runId, deps.now(), { ok: true, items: items.length, events: events.length });
    const stdout = parts.join("\n").trimEnd();
    return { stdout: stdout ? `${stdout}\n` : "", stderr: "", exitCode: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const now = deps.now();
    const failures = Number(store.getMeta(META.failures) ?? 0) + 1;
    const wait = backoffMs(cfg.rails, failures);
    store.setMeta(META.failures, String(failures));
    store.setMeta(META.nextTickAt, String(now + wait));
    store.finishRun(runId, now, { ok: false, error: msg });
    const until = new Date(now + wait).toISOString().slice(0, 16).replace("T", " ") + "Z";
    return { stdout: "", stderr: `prflow tick failed (${failures} in a row; next tick after ${until}): ${msg}\n`, exitCode: 1 };
  } finally {
    store.unlock();
  }
}
