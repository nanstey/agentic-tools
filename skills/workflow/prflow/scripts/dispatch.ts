/**
 * Rails-gated dispatch lifecycle on top of the store:
 * planned -> launched -> working -> done | failed | stale | abandoned.
 *
 * `beginDispatch` is the only way to start work. It enforces idempotency on
 * (item, version, kind), pauses, retries, the loop breaker, and the caps, then
 * writes the `planned` row, a `started` ledger row, and the caller's event, all
 * before the caller performs any side effect.
 */
import type { Rails } from "./core/config.ts";
import type { EventInput } from "./core/events.ts";
import { legacyCovers } from "./core/legacy.ts";
import { capWindow, checkStart, DAY_MS, HOUR_MS, isOpen, leaseExpired, type DispatchState } from "./core/rails.ts";
import type { Kind } from "../../../../lib/pr/types.ts";
import type { Dispatch, Store } from "./store.ts";

export interface TickContext {
  now: number;
  /** Run id of the current tick (scopes the per-tick cap announcement). */
  tickId: number;
  rails: Rails;
  /** Starts made so far in this tick; `beginDispatch` increments it. */
  starts: number;
}

export interface StartRequest {
  item: string;
  version: string;
  kind: Kind;
  /** Trigger detail (job ids, comment timestamp), matched against legacy entries. */
  trigger?: string | null;
  /** Event written right after the row, before the side effect. */
  event: Omit<EventInput, "item" | "version" | "kind" | "dispatchId">;
}

export type StartResult = { ok: true; dispatch: Dispatch } | { ok: false; reason: string };

/** True when a legacy automation already handled this item, version, and kind. */
export function legacyHandled(store: Store, item: string, version: string, kind: Kind, trigger: string | null): boolean {
  return store
    .ledger(item)
    .some((e) => e.source.startsWith("legacy:") && legacyCovers({ ...e, kind: e.kind as Kind, detail: e.detail ?? null }, item, version, kind, trigger));
}

/** Pause one item and emit `paused`. */
export function pauseItem(store: Store, now: number, item: string, reason: string, extra: Partial<EventInput> = {}): void {
  if (store.pauseItem(item, reason, now)) store.appendEvent(now, { ...extra, type: "paused", item, detail: reason });
}

export function beginDispatch(store: Store, ctx: TickContext, req: StartRequest): StartResult {
  const { now, rails } = ctx;
  const { item, version, kind } = req;
  const ev = { item, version, kind };
  const sys = store.systemPaused();
  if (sys !== null) return { ok: false, reason: `prflow paused: ${sys}` };
  const row = store.item(item);
  if (row?.paused) return { ok: false, reason: `item paused: ${row.pausedReason ?? ""}` };

  const existing = store.findDispatch(item, version, kind);
  if (existing) {
    if (isOpen(existing.state)) return { ok: false, reason: `dispatch #${existing.id} ${existing.state}` };
    if (existing.state === "done" || existing.state === "abandoned")
      return { ok: false, reason: `dispatch #${existing.id} ${existing.state}` };
    if (existing.attempts >= rails.maxAttempts) {
      const why = `${existing.attempts} attempts ended ${existing.state}`;
      store.transition(existing.id, "abandoned", now, { detail: why });
      store.appendEvent(now, { ...ev, type: "abandoned", dispatchId: existing.id, detail: why });
      pauseItem(store, now, item, `dispatch #${existing.id} abandoned after ${why}`, { version, kind, dispatchId: existing.id });
      return { ok: false, reason: `abandoned: ${why}` };
    }
  } else if (legacyHandled(store, item, version, kind, req.trigger ?? null)) {
    return { ok: false, reason: "handled by a legacy automation" };
  }

  const verdict = checkStart(rails, {
    thisTick: ctx.starts,
    open: store.openDispatches().length,
    lastHour: store.countStarts(now - HOUR_MS),
    lastDay: store.countStarts(now - DAY_MS),
    sameVersion: store.countStarts(now - DAY_MS, item, version),
    acrossVersions: store.countStarts(now - DAY_MS, item),
  });
  if (!verdict.ok && verdict.rail === "loop") {
    store.appendEvent(now, { ...ev, type: "rail-tripped", detail: `loop breaker: ${verdict.reason}` });
    pauseItem(store, now, item, `loop breaker: ${verdict.reason}`, { version, kind });
    return { ok: false, reason: `loop breaker: ${verdict.reason}` };
  }
  if (!verdict.ok && verdict.rail === "cap") {
    const key = `cap-announced:${capWindow(verdict.cap, now, ctx.tickId)}`;
    if (store.getMeta(key) === null) {
      store.setMeta(key, String(now));
      store.appendEvent(now, { type: "rail-tripped", detail: `cap ${verdict.cap}=${verdict.limit} reached; further starts wait` });
    }
    return { ok: false, reason: `cap ${verdict.cap} reached` };
  }

  const d = existing ? store.transition(existing.id, "planned", now, { detail: null }) : store.createDispatch(item, version, kind, now);
  store.addLedger({ at: now, item, version, kind, outcome: "started", dispatchId: d.id, source: "prflow" });
  ctx.starts++;
  store.appendEvent(now, { ...req.event, ...ev, dispatchId: d.id });
  return { ok: true, dispatch: d };
}

/** Record the outcome of a dispatch in its row and the ledger. */
export function finishDispatch(store: Store, now: number, d: Dispatch, to: DispatchState, detail: string | null): Dispatch {
  const out = store.transition(d.id, to, now, { detail });
  store.addLedger({ at: now, item: d.item, version: d.version, kind: d.kind, outcome: to, detail, dispatchId: d.id, source: "prflow" });
  return out;
}

/**
 * Reconcile open dispatches at the start of a tick. `verify` may settle a
 * dispatch from fresh facts (for example the action's effect is visible); it
 * returns the final state and a detail, or `null` when it cannot tell. Any open
 * dispatch still unsettled whose lease ran out becomes `stale`.
 */
export function reconcile(
  store: Store,
  ctx: Pick<TickContext, "now" | "rails">,
  verify: (d: Dispatch) => { state: "done" | "failed"; detail: string } | null = () => null,
): void {
  const { now, rails } = ctx;
  for (const d of store.openDispatches()) {
    const v = verify(d);
    if (v) {
      if (d.state === "planned" && v.state === "done") store.transition(d.id, "launched", now);
      finishDispatch(store, now, store.dispatch(d.id) as Dispatch, v.state, v.detail);
      store.appendEvent(now, { type: "recovered", item: d.item, version: d.version, kind: d.kind, dispatchId: d.id, sessionHandle: d.sessionHandle, detail: `${v.state}: ${v.detail}` });
      continue;
    }
    if (!leaseExpired(rails, d, now)) continue;
    const detail = d.state === "planned" ? "interrupted before the action was confirmed" : "lease expired with no progress";
    finishDispatch(store, now, d, "stale", detail);
    store.appendEvent(now, { type: "session-stale", item: d.item, version: d.version, kind: d.kind, dispatchId: d.id, sessionHandle: d.sessionHandle, detail });
  }
}
