import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { describe, it } from "node:test";
import { importLegacy, pause, resume, status } from "../scripts/commands.ts";
import { leaseUntil, MINUTE_MS } from "../scripts/core/rails.ts";
import { DEFAULT_RAILS } from "../scripts/core/config.ts";
import { LOCK_HUNG_MS, LOCK_KEY, lockStale, Store } from "../scripts/store.ts";
import { META, tick } from "../scripts/tick.ts";
import { prResponse, run } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, T0, tempStore, world } from "./state-helpers.ts";

const BEHIND = prResponse({ merge: "BEHIND", decision: null });

describe("tick", () => {
  it("prints the report on the first tick, then stays silent while nothing changes", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND } });
    const first = await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    assert.equal(first.exitCode, 0);
    assert.match(first.stdout, /^## Ready to act \(1\)\n- Acme\/x#1 "Fixture PR" \| behind:/);
    w.clock += 15 * MIN;
    assert.deepEqual(await tick(fakeTickDeps(w), s, cfg(), { dryRun: true }), { stdout: "", stderr: "", exitCode: 0 });
    assert.equal(s.lastRun()?.ok, true);
  });

  it("is silent on a first tick with nothing actionable, and reports when the set empties", async () => {
    const s = tempStore();
    const w = world();
    assert.equal((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, "");
    w.prs = { "Acme/x#1": BEHIND };
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, /behind/);
    w.prs = {};
    assert.equal((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, "Nothing to report.\n");
  });

  it("prints new events since the last tick once, before the report", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND } });
    await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    pause(s, T0, { item: "Acme/x#1" }, "checking by hand");
    const out = (await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout;
    assert.match(out, /^## New events \(1\)\n- 2026-01-12 17:00Z paused Acme\/x#1: checking by hand\n\n/);
    assert.match(out, /## Needs your decision \(1\)\n- Acme\/x#1 paused: checking by hand/);
    assert.equal((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, "");
  });

  it("does nothing while prflow is paused, then reports the held events after resume", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND } });
    pause(s, T0, {}, "maintenance");
    assert.deepEqual(await tick(fakeTickDeps(w), s, cfg(), { dryRun: true }), { stdout: "", stderr: "", exitCode: 0 });
    assert.equal(w.calls.length, 0);
    assert.equal(s.lastRun(), null);
    resume(s, T0 + MIN, {});
    const out = (await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout;
    assert.match(out, /^## New events \(2\)\n- .* paused prflow: maintenance\n- .* resumed prflow/);
    assert.equal(w.calls.length > 0, true);
  });

  it("fails on scan errors without advancing events or the report, and backs off", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND }, searchError: "HTTP 502" });
    pause(s, T0, { item: "Acme/x#1" }, "test");
    const r = await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    assert.equal(r.exitCode, 1);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /prflow tick failed \(1 in a row; next tick after 2026-01-12 17:15Z\): scan incomplete:\nwarn: octocat: gh search prs .*HTTP 502/);
    assert.equal(s.getMeta(META.eventsOffset), null);
    assert.equal(s.lastRun()?.ok, false);

    // Inside the backoff window: no scan, no output.
    w.searchError = undefined;
    w.calls.length = 0;
    w.clock = T0 + 14 * MIN;
    assert.deepEqual(await tick(fakeTickDeps(w), s, cfg(), { dryRun: true }), { stdout: "", stderr: "", exitCode: 0 });
    assert.equal(w.calls.length, 0);

    // A second failure doubles the wait.
    w.clock = T0 + 16 * MIN;
    w.searchError = "HTTP 502";
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stderr, /2 in a row; next tick after 2026-01-12 17:46Z/);

    // Recovery resets the counter and delivers the held event and the report.
    w.searchError = undefined;
    w.clock = T0 + 47 * MIN;
    const ok = await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    assert.equal(ok.exitCode, 0);
    assert.match(ok.stdout, /paused Acme\/x#1: test/);
    assert.match(ok.stdout, /- Acme\/x#1 paused: test/);
    assert.equal(s.getMeta(META.failures), "0");
  });

  it("fails when the scan exceeds the poll budget", async () => {
    const s = tempStore();
    const w = world({ hang: true });
    const r = await tick(fakeTickDeps(w), s, cfg({ pollBudgetSeconds: 1 }), { dryRun: true });
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /scan exceeded its 1s budget/);
  });

  it("exits silently while a live tick holds the lock, and takes over a dead or hung one", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND } });
    s.setMeta(LOCK_KEY, `${process.pid} ${T0 - 2 * 60 * MIN} other`);
    assert.deepEqual(await tick(fakeTickDeps(w), s, cfg(), { dryRun: true }), { stdout: "", stderr: "", exitCode: 0 });
    assert.equal(w.calls.length, 0);
    // Same live pid, but past the hung limit.
    w.clock = T0 - 2 * 60 * MIN + LOCK_HUNG_MS;
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, /behind/);
    assert.equal(s.getMeta(LOCK_KEY), null);
    // A dead pid is taken over at once; a malformed value too.
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    assert.equal(lockStale(`${dead} ${w.clock} x`, w.clock), true);
    assert.equal(lockStale("garbage", w.clock), true);
    assert.equal(lockStale(`${process.pid} ${w.clock} x`, w.clock), false);
  });

  it("lets only one of two stores take the lock, and never releases another's", () => {
    const s = tempStore();
    const other = Store.open(s.dir);
    assert.equal(s.tryLock(T0), true);
    assert.equal(other.tryLock(T0), false);
    other.unlock();
    assert.notEqual(s.getMeta(LOCK_KEY), null);
    s.setMeta(LOCK_KEY, `${process.pid} ${T0} someone-else`);
    s.unlock();
    assert.equal(s.getMeta(LOCK_KEY), `${process.pid} ${T0} someone-else`);
    other.close();
  });

  it("releases the lock after a failure", async () => {
    const s = tempStore();
    await tick(fakeTickDeps(world({ searchError: "x" })), s, cfg(), { dryRun: true });
    assert.equal(s.getMeta(LOCK_KEY), null);
  });

  it("marks expired dispatches stale and lists open ones as in flight", async () => {
    const s = tempStore();
    const w = world();
    const a = s.transition(s.createDispatch("Acme/a#1", "v1", "ci", T0).id, "launched", T0, { leaseUntil: leaseUntil(DEFAULT_RAILS, T0) });
    const out = (await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout;
    assert.match(out, /## In flight \(1\)\n- Acme\/a#1 ci #1 launched \| attempt 1 \| lease until 17:45Z/);
    w.clock = T0 + 46 * MIN;
    const later = (await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout;
    assert.equal(s.dispatch(a.id)?.state, "stale");
    assert.match(later, /session-stale Acme\/a#1 ci #1: lease expired with no progress/);
    assert.match(later, /Nothing to report\./);
  });

  it("records every scanned item", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND, "Acme/y#2": prResponse({ decision: null, checks: [run("t", "IN_PROGRESS", null)] }) } });
    await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    assert.deepEqual(s.items().map((i) => `${i.key} ${i.kind}`), ["Acme/x#1 behind", "Acme/y#2 waiting"]);
  });
});

describe("status", () => {
  it("reports items, open dispatches with leases, pauses, backoff, and the last tick", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": BEHIND } });
    await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    s.transition(s.createDispatch("Acme/x#1", "v", "behind", T0).id, "launched", T0, { leaseUntil: T0 + 45 * MINUTE_MS });
    pause(s, T0, { item: "Acme/z#9" }, "manual");
    const st = status(s, T0);
    assert.equal(st.paused, null);
    assert.deepEqual(st.pausedItems, [{ item: "Acme/z#9", reason: "manual", since: new Date(T0).toISOString() }]);
    assert.deepEqual(st.items.map((i) => i.key), ["Acme/x#1", "Acme/z#9"]);
    assert.equal(st.openDispatches[0]?.leaseExpiresAt, "2026-01-12T17:45:00.000Z");
    assert.equal(st.lastTick?.ok, true);
    assert.equal(st.backoff.nextTickAt, null);
    assert.doesNotThrow(() => JSON.stringify(st));
  });
});

describe("pause and resume", () => {
  it("pauses and resumes the system and items with events, idempotently", () => {
    const s = tempStore();
    assert.equal(pause(s, T0, {}, "r"), "paused prflow");
    assert.equal(pause(s, T0, {}, "r"), "prflow was already paused");
    assert.equal(s.systemPaused(), "r");
    assert.equal(pause(s, T0, { item: "Acme/x#1" }, "r"), "paused Acme/x#1");
    assert.equal(pause(s, T0, { item: "acme/X#1" }, "r"), "acme/X#1 was already paused");
    assert.equal(resume(s, T0, { item: "Acme/y#2" }), "Acme/y#2 was not paused");
    assert.equal(resume(s, T0, {}), "resumed prflow");
    assert.equal(s.item("Acme/x#1")?.paused, true, "a plain resume leaves items paused");
    assert.equal(resume(s, T0, { all: true }), "resumed Acme/x#1");
    assert.equal(resume(s, T0, { all: true }), "nothing was paused");
    assert.deepEqual(s.readEventsFrom(0).events.map((e) => `${e.type} ${e.item ?? "-"}`), ["paused -", "paused Acme/x#1", "resumed -", "resumed Acme/x#1"]);
  });
});

describe("importLegacy", () => {
  it("imports both files into the ledger once and never writes them", () => {
    const s = tempStore();
    const files = [
      { source: "pr-comment-watch" as const, path: "/a", text: "Acme/x#1@9cc2a137:comments:2026-09-24T19:10:57Z\nAcme/x#1@9cc2a137:ci\ngarbage\n" },
      { source: "pr-watch" as const, path: "/b", text: "Acme/y#2@20b3ff8a\n" },
      { source: "pr-watch" as const, path: "/missing", text: null },
    ];
    assert.equal(
      importLegacy(s, T0, files),
      "pr-comment-watch: 2 imported, 0 already present, 1 unparsed\n  unparsed: garbage\npr-watch: 1 imported, 0 already present, 0 unparsed\npr-watch: /missing not found, skipped",
    );
    assert.match(importLegacy(s, T0, files), /pr-comment-watch: 0 imported, 2 already present/);
    assert.deepEqual(
      s.ledger().map((l) => `${l.item} ${l.version} ${l.kind} ${l.detail ?? "-"} ${l.source}`),
      [
        "Acme/x#1 9cc2a137 comments 2026-09-24T19:10:57Z legacy:pr-comment-watch",
        "Acme/x#1 9cc2a137 ci - legacy:pr-comment-watch",
        "Acme/y#2 20b3ff8a review-requested - legacy:pr-watch",
      ],
    );
    assert.equal(s.countStarts(0), 0, "legacy rows do not count toward caps or the loop breaker");
  });
});
