import assert from "node:assert/strict";
import test from "node:test";
import { composeFeed, dueDispatches, failureOf, filterRepeats, pruneList, REPEAT_WINDOW_MS, stamp, type ToolRun } from "../scripts/core.ts";

const run = (over: Partial<ToolRun>): ToolRun => ({ name: "prflow watch", exitCode: 0, stdout: "", stderr: "", timedOut: false, outPath: "/s/w.out", errPath: "/s/w.err", ...over });
const AT = new Date("2026-11-20T20:30:00.000Z");

test("stamp sorts by time and has no colons", () => {
  assert.equal(stamp(AT), "2026-11-20T20-30-00-000Z");
});

test("empty tool output and no failures make an empty feed", () => {
  assert.equal(composeFeed({ at: AT, runs: [run({ name: "repo-sync" }), run({})], due: [], failures: [] }), "");
  assert.equal(composeFeed({ at: AT, runs: [run({ stdout: "  \n" })], due: [], failures: [] }), "");
});

test("non-empty output becomes a section under a timestamped header", () => {
  const feed = composeFeed({ at: AT, runs: [run({ name: "repo-sync", stdout: "pulled 2\n" }), run({ stdout: "## Needs you\n- x\n" })], due: [], failures: [] });
  assert.match(feed, /^# orca-orchestrator feed 2026-11-20T20:30:00.000Z\n/);
  assert.match(feed, /## repo-sync\n\npulled 2\n\n## prflow watch\n\n## Needs you\n- x\n$/);
});

test("output of a failed run is left to the failure entry", () => {
  const feed = composeFeed({ at: AT, runs: [run({ exitCode: 1, stdout: "partial" })], due: [], failures: [] });
  assert.equal(feed, "");
});

test("failureOf covers exit codes, timeouts, and spawn errors", () => {
  assert.equal(failureOf(run({})), null);
  const exit = failureOf(run({ exitCode: 1, stderr: "warn: gh failed\nmore\n" }));
  assert.equal(exit?.signature, "prflow watch|exit 1|warn: gh failed");
  assert.match(exit?.text ?? "", /^- prflow watch exited 1\. Full errors: \/s\/w\.err\n  warn: gh failed\n  more$/);
  assert.match(failureOf(run({ exitCode: null, timedOut: true }))?.text ?? "", /still running at the precheck deadline; it was left to finish/);
  assert.match(failureOf(run({ exitCode: null, error: "spawn ENOENT" }))?.text ?? "", /could not start: spawn ENOENT/);
});

test("a failure is a feed entry", () => {
  const f = failureOf(run({ exitCode: 1, stderr: "boom" }));
  assert.ok(f);
  assert.match(composeFeed({ at: AT, runs: [], due: [], failures: [f] }), /## Failures \(1\)\n\n- prflow watch exited 1/);
});

test("filterRepeats reports a repeat only after the window and forgets fixed failures", () => {
  const f = { signature: "a", text: "- a" };
  const first = filterRepeats([f], {}, 1000);
  assert.deepEqual(first.report, [f]);
  const again = filterRepeats([f], first.memory, 1000 + REPEAT_WINDOW_MS - 1);
  assert.deepEqual(again.report, []);
  assert.deepEqual(again.memory, { a: 1000 });
  assert.deepEqual(filterRepeats([f], again.memory, 1000 + REPEAT_WINDOW_MS).report, [f]);
  const fixed = filterRepeats([], first.memory, 2000);
  assert.deepEqual(fixed.memory, {});
  assert.deepEqual(filterRepeats([f], fixed.memory, 3000).report, [f]);
});

test("dueDispatches keeps dispatches without a live lease", () => {
  const now = 10_000;
  const json = JSON.stringify({
    openDispatches: [
      { id: 1, item: "a/b#1", kind: "ci", state: "sent", sessionHandle: "term_1", leaseUntil: now + 1 },
      { id: 2, item: "a/b#2", kind: "comments", state: "sent", sessionHandle: "term_2", leaseUntil: now },
      { id: 3, item: "a/b#3", kind: "behind", state: "planned", sessionHandle: null, leaseUntil: null },
    ],
  });
  assert.deepEqual(dueDispatches(json, now).map((d) => d.id), [2, 3]);
  assert.throws(() => dueDispatches("{}", now), /no openDispatches/);
  const feed = composeFeed({ at: AT, runs: [], due: dueDispatches(json, now), failures: [] });
  assert.match(feed, /## prflow dispatches due \(2\)/);
  assert.match(feed, /- a\/b#3 behind #3 \| planned \| session none \| no lease/);
  assert.match(feed, /run `prflow tick` in this run/);
});

test("pruneList keeps the newest entries", () => {
  assert.deepEqual(pruneList(["c", "a", "b"], 2), ["a"]);
  assert.deepEqual(pruneList(["a"], 5), []);
});
