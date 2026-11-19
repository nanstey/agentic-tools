/** State commands that need no scan: status, pause, resume, recover, import-legacy. */
import { parseLegacy, type LegacySource } from "./core/legacy.ts";
import { isOpen } from "./core/rails.ts";
import { finishDispatch, pauseItem } from "./dispatch.ts";
import type { Store } from "./store.ts";
import { inFlightRow, META } from "./tick.ts";

export function status(store: Store, now: number) {
  const lastScanAt = store.getMeta(META.lastScanAt);
  const nextTickAt = Number(store.getMeta(META.nextTickAt) ?? 0);
  return {
    stateDir: store.dir,
    now: new Date(now).toISOString(),
    paused: store.systemPaused(),
    pausedItems: store.pausedItems().map((i) => ({
      item: i.key,
      reason: i.pausedReason,
      since: i.pausedAt !== null ? new Date(i.pausedAt).toISOString() : null,
    })),
    lastTick: store.lastRun(),
    backoff: {
      failures: Number(store.getMeta(META.failures) ?? 0),
      nextTickAt: nextTickAt > now ? new Date(nextTickAt).toISOString() : null,
    },
    lastScanAt: lastScanAt !== null ? new Date(Number(lastScanAt)).toISOString() : null,
    items: lastScanAt !== null ? store.currentItems(Number(lastScanAt)) : store.pausedItems(),
    openDispatches: store.openDispatches().map((d) => ({
      ...d,
      leaseExpiresAt: d.leaseUntil !== null ? new Date(d.leaseUntil).toISOString() : null,
    })),
  };
}

export function renderStatus(s: ReturnType<typeof status>): string {
  const t = s.lastTick;
  const lines = [
    `state: ${s.stateDir}`,
    `paused: ${s.paused ?? "no"}`,
    `last tick: ${t ? `${new Date(t.startedAt).toISOString()} ${t.ok === null ? "running" : t.ok ? "ok" : `failed: ${t.error ?? ""}`}${t.dryRun ? " (dry run)" : ""}` : "never"}`,
  ];
  if (s.backoff.nextTickAt) lines.push(`backoff: ${s.backoff.failures} failed ticks; next tick after ${s.backoff.nextTickAt}`);
  lines.push(`items: ${s.items.length}, open dispatches: ${s.openDispatches.length}, paused items: ${s.pausedItems.length}`);
  for (const d of s.openDispatches) lines.push(inFlightRow(d, Date.parse(s.now)));
  for (const p of s.pausedItems) lines.push(`- ${p.item} paused: ${p.reason ?? ""}`);
  return lines.join("\n");
}

/** Pause one item or the whole system. Returns the message to print. */
export function pause(store: Store, now: number, target: { item?: string }, reason: string): string {
  if (target.item) {
    if (!store.item(target.item)?.paused) {
      pauseItem(store, now, target.item, reason);
      return `paused ${target.item}`;
    }
    return `${target.item} was already paused`;
  }
  if (store.systemPaused() !== null) return "prflow was already paused";
  store.setSystemPaused(reason);
  store.appendEvent(now, { type: "paused", detail: reason });
  return "paused prflow";
}

/** Resume one item, the whole system, or (`all`) the system and every item. */
export function resume(store: Store, now: number, target: { item?: string; all?: boolean }): string {
  const out: string[] = [];
  const resumeOne = (key: string) => {
    if (store.resumeItem(key)) {
      store.appendEvent(now, { type: "resumed", item: key });
      out.push(`resumed ${key}`);
    }
  };
  if (target.item) {
    resumeOne(target.item);
    return out[0] ?? `${target.item} was not paused`;
  }
  if (store.systemPaused() !== null) {
    store.setSystemPaused(null);
    store.appendEvent(now, { type: "resumed" });
    out.push("resumed prflow");
  }
  if (target.all) for (const i of store.pausedItems()) resumeOne(i.key);
  return out.join("\n") || "nothing was paused";
}

/**
 * `prflow recover <id>`: give one dispatch a fresh start. An open dispatch is
 * marked stale (the next tick closes its session and launches a new one); a
 * failed, stale, or abandoned one is reopened. Attempts and the item's loop
 * breaker count restart from zero, and a pause this dispatch caused is lifted.
 * The next tick retries it while the PR still needs the same work.
 */
export function recover(store: Store, now: number, id: number): string {
  const d = store.dispatch(id);
  if (!d) throw new Error(`dispatch #${id} not found`);
  if (d.state === "done") throw new Error(`dispatch #${id} is done; nothing to recover`);
  const why = "recovered by hand (prflow recover)";
  if (isOpen(d.state)) finishDispatch(store, now, d, "stale", why);
  store.reopenDispatch(id, now, why);
  store.addLedger({ at: now, item: d.item, version: d.version, kind: d.kind, outcome: "recovered", detail: why, dispatchId: id, source: "prflow" });
  store.appendEvent(now, {
    type: "recovered",
    item: d.item,
    version: d.version,
    kind: d.kind,
    dispatchId: id,
    sessionHandle: d.sessionHandle,
    detail: `${why}: was ${d.state} after ${d.attempts} attempt(s); the next tick retries it${d.sessionHandle ? `, replacing session ${d.sessionHandle}` : ""}`,
  });
  const out = [`recovered dispatch #${id} (${d.item} ${d.kind}, was ${d.state}); the next tick retries it`];
  const item = store.item(d.item);
  if (item?.paused) {
    const reason = item.pausedReason ?? "";
    if (reason.includes(`dispatch #${id} `) || reason.startsWith("loop breaker")) {
      store.resumeItem(d.item);
      store.appendEvent(now, { type: "resumed", item: d.item, detail: `prflow recover #${id}` });
      out.push(`resumed ${d.item}`);
    } else out.push(`${d.item} stays paused (${reason}); run prflow resume --item ${d.item} to let the retry start`);
  }
  return out.join("\n");
}

export interface LegacyFile {
  source: LegacySource;
  path: string;
  /** File text, `null` when the file does not exist. */
  text: string | null;
}

/** Import legacy `dispatched.txt` entries into the ledger. Idempotent; reads only. */
export function importLegacy(store: Store, now: number, files: LegacyFile[]): string {
  const lines: string[] = [];
  for (const f of files) {
    if (f.text === null) {
      lines.push(`${f.source}: ${f.path} not found, skipped`);
      continue;
    }
    const { entries, bad } = parseLegacy(f.source, f.text);
    let added = 0;
    for (const e of entries)
      if (store.addLedger({ at: now, item: e.item, version: e.version, kind: e.kind, outcome: "legacy-dispatched", detail: e.detail, source: `legacy:${e.source}`, ref: e.ref }))
        added++;
    lines.push(`${f.source}: ${added} imported, ${entries.length - added} already present, ${bad.length} unparsed`);
    for (const b of bad) lines.push(`  unparsed: ${b}`);
  }
  return lines.join("\n");
}
