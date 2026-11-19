import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_RAILS, type Rails } from "../scripts/core/config.ts";
import { HOUR_MS, leaseUntil } from "../scripts/core/rails.ts";
import { beginDispatch, finishDispatch, reconcile, type StartRequest, type TickContext } from "../scripts/dispatch.ts";
import type { Store } from "../scripts/store.ts";
import { MIN, T0, tempStore } from "./state-helpers.ts";

const ctx = (now = T0, rails: Partial<Rails> = {}, tickId = 1): TickContext => ({ now, tickId, rails: { ...DEFAULT_RAILS, ...rails }, starts: 0 });
const req = (item = "Acme/x#1", version = "aaaaaaaa-11111111", kind: StartRequest["kind"] = "rerun"): StartRequest => ({
  item,
  version,
  kind,
  event: { type: "rerun", detail: "test" },
});
const types = (s: Store) => s.readEventsFrom(0).events.map((e) => `${e.type}${e.item ? ` ${e.item}` : ""}`);

/** Start and close a dispatch with `outcome`. */
function startAndClose(s: Store, c: TickContext, r: StartRequest, outcome: "done" | "failed" = "failed") {
  const res = beginDispatch(s, c, r);
  assert.ok(res.ok, JSON.stringify(res));
  const d = s.transition(res.dispatch.id, "launched", c.now, { leaseUntil: leaseUntil(c.rails, c.now) });
  return finishDispatch(s, c.now, d, outcome, null);
}

describe("beginDispatch", () => {
  it("writes the planned row, a started ledger row, and the event before returning", () => {
    const s = tempStore();
    const c = ctx();
    const r = beginDispatch(s, c, req());
    assert.ok(r.ok);
    assert.equal(r.dispatch.state, "planned");
    assert.equal(c.starts, 1);
    assert.deepEqual(s.ledger().map((l) => l.outcome), ["started"]);
    const [ev] = s.readEventsFrom(0).events;
    assert.deepEqual({ ...ev, ts: "" }, { ts: "", type: "rerun", item: "Acme/x#1", version: "aaaaaaaa-11111111", kind: "rerun", dispatchId: r.dispatch.id, sessionHandle: null, detail: "test" });
  });

  it("is idempotent on (item, version, kind) while open and after done", () => {
    const s = tempStore();
    assert.ok(beginDispatch(s, ctx(), req()).ok);
    const again = beginDispatch(s, ctx(), req("acme/X#1"));
    assert.deepEqual(again, { ok: false, reason: "dispatch #1 planned" });
    const d = s.findDispatch("Acme/x#1", "aaaaaaaa-11111111", "rerun");
    assert.ok(d);
    finishDispatch(s, T0, s.transition(d.id, "launched", T0), "done", null);
    assert.deepEqual(beginDispatch(s, ctx(), req()), { ok: false, reason: "dispatch #1 done" });
    // A new version or another kind is new work.
    assert.ok(beginDispatch(s, ctx(), req("Acme/x#1", "bbbbbbbb-11111111")).ok);
    assert.ok(beginDispatch(s, ctx(), req("Acme/x#1", "aaaaaaaa-11111111", "cleanup")).ok);
  });

  it("retries a failed dispatch on the same row, then abandons it and pauses the item", () => {
    const s = tempStore();
    const rails = { maxAttempts: 2, loopSameVersion: 99 };
    startAndClose(s, ctx(T0, rails), req());
    const retry = beginDispatch(s, ctx(T0 + MIN, rails), req());
    assert.ok(retry.ok);
    assert.equal(retry.dispatch.id, 1);
    assert.equal(retry.dispatch.attempts, 2);
    finishDispatch(s, T0 + MIN, s.transition(1, "launched", T0 + MIN), "failed", "boom");
    const r = beginDispatch(s, ctx(T0 + 2 * MIN, rails), req());
    assert.equal(r.ok, false);
    assert.equal(s.dispatch(1)?.state, "abandoned");
    assert.equal(s.item("Acme/x#1")?.paused, true);
    assert.deepEqual(types(s).slice(-2), ["abandoned Acme/x#1", "paused Acme/x#1"]);
  });

  it("skips paused items and a paused system", () => {
    const s = tempStore();
    s.pauseItem("Acme/x#1", "manual", T0);
    assert.deepEqual(beginDispatch(s, ctx(), req()), { ok: false, reason: "item paused: manual" });
    s.setSystemPaused("maintenance");
    assert.deepEqual(beginDispatch(s, ctx(), req("Acme/y#2")), { ok: false, reason: "prflow paused: maintenance" });
    assert.equal(s.openDispatches().length, 0);
  });

  it("trips the loop breaker on the 4th start of one version in 24h, pauses the item, and emits events", () => {
    const s = tempStore();
    const rails = { maxAttempts: 99 };
    for (let i = 0; i < 3; i++) startAndClose(s, ctx(T0 + i * MIN, rails), req());
    const r = beginDispatch(s, ctx(T0 + 3 * MIN, rails), req());
    assert.ok(!r.ok && r.reason.startsWith("loop breaker"));
    assert.equal(s.item("Acme/x#1")?.paused, true);
    assert.deepEqual(types(s).slice(-2), ["rail-tripped Acme/x#1", "paused Acme/x#1"]);
    // Other items are unaffected.
    assert.ok(beginDispatch(s, ctx(T0 + 3 * MIN, rails), req("Acme/y#2")).ok);
  });

  it("forgets starts older than 24h", () => {
    const s = tempStore();
    const rails = { maxAttempts: 99 };
    for (let i = 0; i < 3; i++) startAndClose(s, ctx(T0 + i * MIN, rails), req());
    assert.ok(beginDispatch(s, ctx(T0 + 25 * HOUR_MS, rails), req()).ok);
  });

  it("trips the loop breaker on the 9th start across versions in 24h", () => {
    const s = tempStore();
    const rails = { perHour: 99, perDay: 99 };
    for (let i = 0; i < 8; i++) startAndClose(s, ctx(T0 + i * MIN, rails), req("Acme/x#1", `v${i}`), "done");
    const r = beginDispatch(s, ctx(T0 + 9 * MIN, rails), req("Acme/x#1", "v9"));
    assert.ok(!r.ok && r.reason.includes("across versions"));
    assert.equal(s.item("Acme/x#1")?.paused, true);
  });

  it("defers at the per-tick cap and announces it once per tick", () => {
    const s = tempStore();
    const c = ctx(T0, { startsPerTick: 1 });
    assert.ok(beginDispatch(s, c, req("Acme/a#1")).ok);
    assert.deepEqual(beginDispatch(s, c, req("Acme/b#2")), { ok: false, reason: "cap startsPerTick reached" });
    assert.equal(beginDispatch(s, c, req("Acme/c#3")).ok, false);
    assert.equal(types(s).filter((t) => t === "rail-tripped").length, 1);
    assert.equal(s.item("Acme/b#2"), null, "a cap defers; it does not pause");
  });

  it("enforces the open, hourly, and daily caps from the store", () => {
    const s = tempStore();
    beginDispatch(s, ctx(), req("Acme/a#1"));
    assert.equal(beginDispatch(s, ctx(T0, { maxOpen: 1 }), req("Acme/b#2")).ok, false);
    assert.equal(beginDispatch(s, ctx(T0, { perHour: 1 }), req("Acme/b#2")).ok, false);
    assert.equal(beginDispatch(s, ctx(T0 + 2 * HOUR_MS, { perHour: 1, perDay: 1 }), req("Acme/b#2")).ok, false);
    assert.ok(beginDispatch(s, ctx(T0 + 2 * HOUR_MS, { perHour: 1 }), req("Acme/b#2")).ok);
  });

  it("skips work a legacy automation already handled at the same head", () => {
    const s = tempStore();
    s.addLedger({ at: T0, item: "Acme/x#1", version: "aaaaaaaa", kind: "comments", outcome: "legacy-dispatched", detail: "2026-01-10T13:00:00Z", source: "legacy:pr-comment-watch", ref: "r1" });
    const r = (trigger: string) => beginDispatch(s, ctx(), { ...req("Acme/x#1", "aaaaaaaa-22222222", "comments"), trigger });
    assert.deepEqual(r("2026-01-10T13:00:00Z"), { ok: false, reason: "handled by a legacy automation" });
    assert.ok(r("2026-01-10T14:00:00Z").ok, "a newer comment is new work");
  });
});

describe("transition", () => {
  it("rejects transitions the state machine forbids", () => {
    const s = tempStore();
    const d = s.createDispatch("Acme/x#1", "v", "rerun", T0);
    assert.throws(() => s.transition(d.id, "done", T0), /planned -> done is not allowed/);
    assert.throws(() => s.transition(99, "launched", T0), /not found/);
  });

  it("renews leases only for open dispatches", () => {
    const s = tempStore();
    const d = s.transition(s.createDispatch("Acme/x#1", "v", "rerun", T0).id, "launched", T0, { leaseUntil: T0 + MIN });
    assert.equal(s.renewLease(d.id, T0 + 10 * MIN, T0 + MIN).leaseUntil, T0 + 10 * MIN);
    s.transition(d.id, "done", T0);
    assert.throws(() => s.renewLease(d.id, T0 + 20 * MIN, T0), /not open/);
  });

  it("rejects a duplicate (item, version, kind) row", () => {
    const s = tempStore();
    s.createDispatch("Acme/x#1", "v", "rerun", T0);
    assert.throws(() => s.createDispatch("acme/x#1", "v", "rerun", T0), /UNIQUE/);
  });
});

describe("reconcile", () => {
  it("marks dispatches stale after the lease and emits session-stale", () => {
    const s = tempStore();
    const c = ctx();
    const a = s.transition(s.createDispatch("Acme/a#1", "v", "rerun", T0).id, "launched", T0, { leaseUntil: leaseUntil(c.rails, T0) });
    s.createDispatch("Acme/b#2", "v", "rerun", T0); // planned, crashed before the side effect was confirmed
    reconcile(s, ctx(T0 + 44 * MIN));
    assert.equal(s.openDispatches().length, 2);
    reconcile(s, ctx(T0 + 46 * MIN));
    assert.equal(s.dispatch(a.id)?.state, "stale");
    assert.equal(s.dispatch(2)?.detail, "interrupted before the action was confirmed");
    assert.deepEqual(types(s), ["session-stale Acme/a#1", "session-stale Acme/b#2"]);
  });

  it("settles dispatches the verifier can confirm and emits recovered", () => {
    const s = tempStore();
    s.createDispatch("Acme/a#1", "v", "rerun", T0);
    reconcile(s, ctx(T0 + MIN), () => ({ state: "done", detail: "checks running again" }));
    assert.equal(s.dispatch(1)?.state, "done");
    assert.deepEqual(types(s), ["recovered Acme/a#1"]);
    assert.deepEqual(s.ledger().map((l) => l.outcome), ["done"]);
  });
});
