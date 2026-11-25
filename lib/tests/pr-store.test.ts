import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { findPrPacket, prStatePath, putPrPacket, putPrRun, readPrStore, summarizePrStore, updatePrStore, type PrIdentity, type PrPacket, type PrRun } from "../pr/store.ts";

const dirs: string[] = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
const identity: PrIdentity = { owner: "Acme", repo: "widgets", number: 7 };
const run = (id: string, over: Partial<PrRun> = {}): PrRun => ({ id, action: "review", mode: "report", force: false, startedAt: new Date().toISOString(), round: 2, limit: 5, drafted_for_changes: false, completion: null, ...over });
const packet = (over: Partial<PrPacket> = {}): PrPacket => ({ base: "base1", head: "head1", policy: "v1", depth: "deep", reason: "coverage", verdict: "needs-fix", findings: [{ id: "F1", category: "bug" }], coverage: [{ path: "src/a.ts", status: "reviewed" }], storedAt: new Date().toISOString(), ...over });
function temp(): string { const dir = mkdtempSync(join(tmpdir(), "pr-store-")); dirs.push(dir); return dir; }

test("PR state path follows XDG and round-trips all persisted facts", () => {
  const dir = temp();
  const path = prStatePath(identity, { XDG_STATE_HOME: dir });
  assert.equal(path, join(dir, "agentic-tools", "pr", "Acme-widgets-7.json"));
  const value = { ...run("run-a", { completion: "complete" }), id: "run-a" };
  const packetValue = packet();
  putPrRun(path, identity, value);
  putPrPacket(path, identity, packetValue);
  const store = readPrStore(path, identity);
  assert.deepEqual(store, {
    version: 1, identity, runs: { "run-a": value },
    packets: { [JSON.stringify(["base1", "head1", "v1"])]: packetValue },
    describedHeads: [], docsOnlyResults: {}, cancelledCheckReruns: {}, lastCompletion: "complete",
  });
  assert.deepEqual(findPrPacket(store, "base1", "head1", "v1"), packetValue);
  assert.equal(store.lastCompletion, "complete");
  putPrRun(path, identity, { ...run("default-limit"), limit: undefined });
  assert.equal(readPrStore(path, identity).runs["default-limit"]?.limit, 5);
  assert.deepEqual(summarizePrStore(store, "head1"), { packetVerdict: "needs-fix", packetHead: "head1", roundsUsed: 2, lastCompletion: "complete" });
});

test("packet lookup requires exact base, head, and policy identity", () => {
  const dir = temp(); const path = prStatePath(identity, { XDG_STATE_HOME: dir });
  putPrPacket(path, identity, packet());
  const store = readPrStore(path, identity);
  assert.equal(findPrPacket(store, "base2", "head1", "v1"), null);
  assert.equal(findPrPacket(store, "base1", "head2", "v1"), null);
  assert.equal(findPrPacket(store, "base1", "head1", "v2"), null);
});

test("runs older than seven days are dropped on write", () => {
  const dir = temp(); const path = prStatePath(identity, { XDG_STATE_HOME: dir });
  const now = Date.parse("2025-01-10T00:00:00.000Z");
  const store = updatePrStore(path, identity, (state) => {
    state.runs.old = run("old", { startedAt: "2025-01-01T00:00:00.000Z" });
    state.runs.fresh = run("fresh", { startedAt: "2025-01-09T00:00:00.000Z" });
  }, now);
  assert.deepEqual(Object.keys(store.runs), ["fresh"]);
});

test("concurrent child writers preserve both runs and readers never see partial JSON", async () => {
  const dir = temp(); const path = prStatePath(identity, { XDG_STATE_HOME: dir });
  const modulePath = new URL("../pr/store.ts", import.meta.url).href;
  const writer = (id: string) => `import { putPrRun } from ${JSON.stringify(modulePath)}; const path=${JSON.stringify(path)}; const identity=${JSON.stringify(identity)}; for(let i=0;i<40;i++) putPrRun(path,identity,{id:${JSON.stringify(id)},action:"review",mode:null,force:false,startedAt:new Date().toISOString(),round:i,limit:5,drafted_for_changes:false,completion:null});`;
  const start = (id: string) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", writer(id)], { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`writer exited ${code}`)));
  });
  let reading = true;
  const reader = (async () => {
    while (reading) {
      try { readPrStore(path, identity); }
      catch (error) { assert.fail(`reader observed an invalid/partial file: ${String(error)}`); }
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  })();
  await Promise.all([start("writer-a"), start("writer-b")]);
  reading = false;
  await reader;
  const result = readPrStore(path, identity);
  assert.deepEqual(Object.keys(result.runs).sort(), ["writer-a", "writer-b"]);
  assert.equal(result.runs["writer-a"]?.round, 39);
  assert.equal(result.runs["writer-b"]?.round, 39);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).identity, identity);
});
