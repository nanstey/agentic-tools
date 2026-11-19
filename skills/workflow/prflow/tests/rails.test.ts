import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_RAILS } from "../scripts/core/config.ts";
import { backoffMs, canTransition, capWindow, checkStart, HOUR_MS, leaseExpired, MINUTE_MS, type DispatchState, type StartCounts } from "../scripts/core/rails.ts";

const zero: StartCounts = { thisTick: 0, open: 0, lastHour: 0, lastDay: 0, sameVersion: 0, acrossVersions: 0 };

describe("checkStart", () => {
  it("allows a start under every limit", () => {
    assert.deepEqual(checkStart(DEFAULT_RAILS, zero), { ok: true });
  });

  const caps: [keyof StartCounts, string, number][] = [
    ["thisTick", "startsPerTick", DEFAULT_RAILS.startsPerTick],
    ["open", "maxOpen", DEFAULT_RAILS.maxOpen],
    ["lastHour", "perHour", DEFAULT_RAILS.perHour],
    ["lastDay", "perDay", DEFAULT_RAILS.perDay],
  ];
  for (const [field, cap, limit] of caps)
    it(`defers at the ${cap} cap and not below it`, () => {
      assert.deepEqual(checkStart(DEFAULT_RAILS, { ...zero, [field]: limit - 1 }), { ok: true });
      assert.deepEqual(checkStart(DEFAULT_RAILS, { ...zero, [field]: limit }), { ok: false, rail: "cap", cap, limit });
    });

  it("trips the loop breaker at 3 starts for one version", () => {
    assert.equal(checkStart(DEFAULT_RAILS, { ...zero, sameVersion: 2, acrossVersions: 2 }).ok, true);
    const v = checkStart(DEFAULT_RAILS, { ...zero, sameVersion: 3, acrossVersions: 3 });
    assert.equal(v.ok === false && v.rail, "loop");
  });

  it("trips the loop breaker at 8 starts across versions", () => {
    assert.equal(checkStart(DEFAULT_RAILS, { ...zero, acrossVersions: 7 }).ok, true);
    const v = checkStart(DEFAULT_RAILS, { ...zero, acrossVersions: 8 });
    assert.ok(v.ok === false && v.rail === "loop" && v.reason.includes("across versions"));
  });

  it("prefers the loop breaker over a full cap", () => {
    const v = checkStart(DEFAULT_RAILS, { ...zero, thisTick: 9, sameVersion: 3 });
    assert.equal(v.ok === false && v.rail, "loop");
  });

  it("uses configured limits", () => {
    assert.equal(checkStart({ ...DEFAULT_RAILS, perHour: 1 }, { ...zero, lastHour: 1 }).ok, false);
  });
});

describe("capWindow", () => {
  it("announces hour and day caps once per window and per-tick caps once per tick", () => {
    const t = Date.parse("2026-01-12T17:10:00Z");
    assert.equal(capWindow("perHour", t, 5), capWindow("perHour", t + 40 * MINUTE_MS, 6));
    assert.notEqual(capWindow("perHour", t, 5), capWindow("perHour", t + HOUR_MS, 5));
    assert.notEqual(capWindow("startsPerTick", t, 5), capWindow("startsPerTick", t, 6));
  });
});

describe("backoffMs", () => {
  it("is zero without failures, doubles, and stops at the max", () => {
    const r = DEFAULT_RAILS;
    assert.equal(backoffMs(r, 0), 0);
    assert.equal(backoffMs(r, 1), 15 * MINUTE_MS);
    assert.equal(backoffMs(r, 2), 30 * MINUTE_MS);
    assert.equal(backoffMs(r, 3), 60 * MINUTE_MS);
    assert.equal(backoffMs(r, 9), 240 * MINUTE_MS);
    assert.equal(backoffMs(r, 1000), 240 * MINUTE_MS);
  });
});

describe("leaseExpired", () => {
  const base = { updatedAt: 0, leaseUntil: 1000 };
  it("expires open dispatches after the lease only", () => {
    assert.equal(leaseExpired(DEFAULT_RAILS, { ...base, state: "launched" }, 1000), false);
    assert.equal(leaseExpired(DEFAULT_RAILS, { ...base, state: "working" }, 1001), true);
  });
  it("never expires closed dispatches", () => {
    for (const state of ["done", "failed", "stale", "abandoned"] as DispatchState[])
      assert.equal(leaseExpired(DEFAULT_RAILS, { ...base, state }, 10 ** 12), false);
  });
  it("uses the last update plus the lease length for planned rows", () => {
    const d = { state: "planned" as const, leaseUntil: null, updatedAt: 0 };
    assert.equal(leaseExpired(DEFAULT_RAILS, d, 45 * MINUTE_MS), false);
    assert.equal(leaseExpired(DEFAULT_RAILS, d, 45 * MINUTE_MS + 1), true);
  });
});

describe("canTransition", () => {
  it("follows planned -> launched -> working -> done|failed|stale|abandoned", () => {
    assert.ok(canTransition("planned", "launched"));
    assert.ok(canTransition("launched", "working"));
    for (const to of ["done", "failed", "stale", "abandoned"] as DispatchState[]) assert.ok(canTransition("working", to));
  });
  it("allows retries from failed and stale only", () => {
    assert.ok(canTransition("failed", "planned"));
    assert.ok(canTransition("stale", "planned"));
    assert.ok(!canTransition("done", "planned"));
    assert.ok(!canTransition("abandoned", "planned"));
  });
  it("forbids skipping or going backwards", () => {
    assert.ok(!canTransition("planned", "working"));
    assert.ok(!canTransition("planned", "done"));
    assert.ok(!canTransition("working", "launched"));
    assert.ok(!canTransition("done", "failed"));
  });
});
