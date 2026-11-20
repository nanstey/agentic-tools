/**
 * `prflow tick`: scan, reconcile, act, report. stdout is the feed the scheduler
 * delivers: new events since the last tick, then the grouped report when it
 * changed. Empty when nothing happened. Exit 1 on failure.
 */
import type { Config } from "./core/config.ts";
import { renderEvent } from "./core/events.ts";
import { backoffMs } from "./core/rails.ts";
import { changeNote, renderTickReport, snapshotOf, sortItems, tickFingerprint, type Snapshot } from "./core/report.ts";
import type { Classification } from "./core/types.ts";
import { reconcile, type TickContext } from "./dispatch.ts";
import { plan, scan, type CmdResult, type Deps, type ScanResult } from "./scan.ts";
import type { Dispatch, ItemRow, Store } from "./store.ts";

export interface TickDeps extends Deps {
  /** Milliseconds since the epoch. */
  now(): number;
  /** `gh run rerun <runId> --failed -R <repo>` as `login`; the only GitHub write. */
  rerunFailed(login: string, repo: string, runId: string): Promise<CmdResult>;
  /**
   * Commits in the worktree at `path` that are on no remote, `0` when HEAD is the
   * PR head (`prHeadSha`) or an ancestor of it, `null` when unknown.
   */
  gitUnpushed(path: string, prHeadSha: string | null): Promise<number | null>;
  /** `orca-ide worktree rm --worktree path:<path> --json`; never forced. */
  archiveWorktree(path: string): Promise<CmdResult>;
  /**
   * The repository's common git dir, the branch checked out in the worktree at
   * `path`, and its commit. `branch` is `null` for a detached HEAD; `null` when unknown.
   */
  branchInfo(path: string): Promise<{ gitDir: string; branch: string | null; sha: string } | null>;
  /**
   * Delete local `refs/heads/<branch>` only while it points at `sha` and no
   * worktree has it checked out (`git update-ref -d`).
   */
  deleteBranch(gitDir: string, branch: string, sha: string): Promise<CmdResult>;
  /** `orca-ide agent list --json` (read). */
  orcaAgents(): Promise<CmdResult>;
  /** `orca-ide terminal list --worktree id:<worktreeId> --json` (read). */
  orcaTerminals(worktreeId: string): Promise<CmdResult>;
  /** `orca-ide agent launch --agent pi --surface terminal --worktree id:<worktreeId> --prompt <brief> --json`. */
  launchPi(worktreeId: string, prompt: string): Promise<CmdResult>;
  /** `orca-ide orchestration send --to <handle> --subject <s> --body <b> --json`; never `terminal send`. */
  sendToAgent(handle: string, subject: string, body: string): Promise<CmdResult>;
  /** `orca-ide terminal close --terminal <handle> --json`. */
  closeTerminal(handle: string): Promise<CmdResult>;
  /** `orca-ide terminal send --terminal <handle> --text <Escape> --json`: stop a busy Pi turn. */
  interruptTerminal(handle: string): Promise<CmdResult>;
  /** `orca-ide terminal wait --terminal <handle> --for tui-idle --timeout-ms <n> --json`. */
  waitIdle(handle: string): Promise<CmdResult>;
  /**
   * `orca-ide worktree create` for one review worktree (`reviewWorktreeArgs`):
   * repo id, `<repo>-<n>-<head8>` slug, PR number. The only worktree prflow creates.
   */
  createReviewWorktree(repoId: string, slug: string, pr: number): Promise<CmdResult>;
  reviewFetch(path: string, number: number, branch: string): Promise<CmdResult>;
  reviewReset(path: string, sha: string, branch: string): Promise<CmdResult>;
  reviewHead(path: string): Promise<string | null>;
  setReviewWorktree(path: string, branch: string, status: string, comment: string, unread?: "--unread" | "--read"): Promise<CmdResult>;
}

export interface TickOptions {
  /** No external side effects for the safe actions (rerun, cleanup); they are only announced. */
  dryRun: boolean;
  /** No Pi session is launched, messaged, nudged, or closed; briefs are only announced. Default `true`. */
  dispatchDryRun?: boolean;
  /** No review worktree is created and no reviewer launched, nudged, closed, or archived; only announced. Default `true`. */
  reviewDryRun?: boolean;
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
  /** JSON `Snapshot` of the rows the last printed report showed. */
  reportItems: "report_items",
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

/** `95` -> `1h35m`. */
export function age(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
}

/** In flight row: item, kind, session handle, state, age, lease, attempt. */
export function inFlightRow(d: Dispatch, now: number): string {
  const lease = d.leaseUntil !== null ? `lease until ${hhmm(d.leaseUntil)}` : "no lease";
  return `- ${d.item} ${d.kind} #${d.id} | session ${d.sessionHandle ?? "none"} | ${d.state} | age ${age(now - d.createdAt)} | ${lease} | attempt ${d.attempts}`;
}

export function pausedRow(i: ItemRow): string {
  return `- ${i.key} paused: ${i.pausedReason ?? "no reason"} | next: \`prflow resume --item ${i.key}\` when resolved | owner: you`;
}

/**
 * Report text and its change fingerprint. Lease times are left out of the
 * fingerprint. `prev` is what the last printed report showed: rows note what
 * changed since then, and `waiting` items may keep a review request counted
 * (`tickFingerprint`).
 */
export function tickReport(actionable: Classification[], open: Dispatch[], paused: ItemRow[], now: number, prev: Snapshot | null = null, waiting: Classification[] = []) {
  const changes = new Map<string, string>();
  for (const c of actionable) {
    const note = changeNote(prev, c);
    if (note) changes.set(c.key.toLowerCase(), note);
  }
  const text = renderTickReport(actionable, {
    inFlight: open.map((d) => inFlightRow(d, now)),
    paused: paused.map(pausedRow),
    changes,
  });
  const fp = [
    tickFingerprint(actionable, waiting, prev),
    ...open.map((d) => `dispatch ${d.id} ${d.state} ${d.attempts} ${d.sessionHandle ?? ""}`),
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

/** Watch open dispatches' sessions (renew leases, settle, recover). Runs before `reconcile`. */
export type Monitor = Act;

function readSnapshot(store: Store): Snapshot {
  try {
    return JSON.parse(store.getMeta(META.reportItems) ?? "{}") as Snapshot;
  } catch {
    return {};
  }
}

/** Adjust items before the report (for example, a review draft is ready). Pure over the store's state. */
export type Annotate = (items: Classification[]) => Classification[];

export async function tick(
  deps: TickDeps,
  store: Store,
  cfg: Config,
  opts: TickOptions,
  hooks: { act?: Act; verify?: (result: ScanResult) => Verify; monitor?: Monitor; annotate?: Annotate } = {},
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
    if (hooks.monitor) await hooks.monitor(ctx, result, items, opts);
    reconcile(store, ctx, hooks.verify?.(result));
    if (hooks.act) await hooks.act(ctx, result, items, opts);

    const shown = hooks.annotate ? hooks.annotate(items) : items;
    const actionable = sortItems(shown).filter((c) => c.kind !== "waiting");
    const prevFp = store.getMeta(META.reportFp);
    const prevRows = readSnapshot(store);
    const report = tickReport(actionable, store.openDispatches(), store.pausedItems(), deps.now(), prevFp === null ? null : prevRows, shown.filter((c) => c.kind === "waiting"));
    const changed = report.fp !== (prevFp ?? "");
    const { events, offset } = store.readEventsFrom(Number(store.getMeta(META.eventsOffset) ?? 0));
    const parts: string[] = [];
    if (events.length) parts.push(`## New events (${events.length})`, ...events.map(renderEvent), "");
    if (changed && prevFp !== null) parts.push(report.text || "Nothing to report.");
    else if (changed && report.text) parts.push(report.text);
    store.setMeta(META.eventsOffset, String(offset));
    store.setMeta(META.reportFp, report.fp);
    if (changed || prevFp === null) store.setMeta(META.reportItems, JSON.stringify(snapshotOf(actionable)));
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
