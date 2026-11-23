import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EXIT, parseOptions, tick, type Options } from "../scripts/tick.ts";

const TICK = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "tick.ts");

/** A fake tool: prints FAKE_<TOOL>_OUT, writes FAKE_<TOOL>_ERR to stderr, exits FAKE_<TOOL>_EXIT, logs its argv. */
const FAKE = `
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const tool = process.argv[1].includes("prflow") ? (args[0] === "status" ? "STATUS" : "WATCH") : "SYNC";
appendFileSync(process.env.FAKE_LOG, JSON.stringify([tool, ...args]) + "\\n");
const e = (k) => process.env["FAKE_" + tool + "_" + k];
const go = () => {
  if (e("REPLACE_LOCK")) writeFileSync(e("REPLACE_LOCK"), e("REPLACEMENT"));
  if (e("OUT")) process.stdout.write(e("OUT"));
  if (e("ERR")) process.stderr.write(e("ERR"));
  process.exit(Number(e("EXIT") ?? 0));
};
const sleep = Number(e("SLEEP") ?? 0);
sleep ? setTimeout(go, sleep) : go();
`;

function world(env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "orca-orch-"));
  const prflow = join(dir, "prflow.mjs");
  const repoSync = join(dir, "repo-sync.mjs");
  writeFileSync(prflow, FAKE);
  writeFileSync(repoSync, FAKE);
  const log = join(dir, "calls.log");
  appendFileSync(log, "");
  let now = Date.parse("2026-11-20T20:30:00.000Z");
  const opts: Options = {
    stateDir: join(dir, "state"),
    keep: 3,
    timeoutMs: 5000,
    watchName: "orca-orchestrator",
    prflow,
    repoSync,
    node: process.execPath,
    env: { ...process.env, FAKE_LOG: log, FAKE_STATUS_OUT: '{"openDispatches":[]}', ...env },
    now: () => now,
  };
  let out = "";
  let err = "";
  const go = async (over: Partial<Options> = {}) => {
    out = "";
    err = "";
    const code = await tick({ ...opts, ...over }, (s) => { out += s; }, (s) => { err += s; });
    now += 15 * 60 * 1000;
    return code;
  };
  const calls = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as string[]);
  return { dir, opts, go, out: () => out, err: () => err, calls };
}

test("nothing to read exits 1 and writes no feed", async () => {
  const w = world();
  assert.equal(await w.go(), EXIT.empty);
  assert.equal(w.out(), "");
  assert.deepEqual(readdirSync(join(w.opts.stateDir, "feed")), []);
  assert.equal(existsSync(join(w.opts.stateDir, "latest.txt")), false);
  assert.equal(existsSync(join(w.opts.stateDir, "lock")), false);
  const calls = w.calls().sort();
  assert.deepEqual(calls, [
    ["STATUS", "status", "--format", "json"],
    ["SYNC", "run"],
    ["WATCH", "watch", "--name", "orca-orchestrator"],
  ]);
});

test("tool output becomes the feed: exit 0, path printed, latest updated", async () => {
  const w = world({ FAKE_SYNC_OUT: "pulled tiger-team-sync\n", FAKE_WATCH_OUT: "## Needs you\n- a/b#1 mergeable\n" });
  assert.equal(await w.go(), EXIT.feed);
  const path = w.out().trim();
  assert.equal(path, join(w.opts.stateDir, "feed", "2026-11-20T20-30-00-000Z.txt"));
  const feed = readFileSync(path, "utf8");
  assert.equal(readFileSync(join(w.opts.stateDir, "latest.txt"), "utf8"), feed);
  assert.match(feed, /## repo-sync\n\npulled tiger-team-sync/);
  assert.match(feed, /## prflow watch\n\n## Needs you\n- a\/b#1 mergeable/);
});

test("--config reaches both tools", async () => {
  const w = world();
  await w.go({ config: "/c/config.json" });
  assert.ok(w.calls().every((c) => c.at(-2) === "--config" && c.at(-1) === "/c/config.json"));
});

test("a tool failure is a feed entry with exit 0; an identical repeat waits for the window", async () => {
  const w = world({ FAKE_WATCH_EXIT: "1", FAKE_WATCH_ERR: "warn: gh search failed for noelcf\n" });
  assert.equal(await w.go(), EXIT.feed);
  const feed = readFileSync(w.out().trim(), "utf8");
  assert.match(feed, /## Failures \(1\)\n\n- prflow watch exited 1\. Full errors: .*prflow-watch\.err\n  warn: gh search failed for noelcf/);
  assert.equal(await w.go(), EXIT.empty, "same failure 15 minutes later is suppressed");
  assert.equal(await w.go(), EXIT.empty);
  assert.equal(await w.go(), EXIT.empty);
  assert.equal(await w.go(), EXIT.feed, "reported again after an hour");
});

test("a missing tool is a feed entry", async () => {
  const w = world();
  assert.equal(await w.go({ repoSync: join(w.dir, "nope.ts") }), EXIT.feed);
  assert.match(readFileSync(w.out().trim(), "utf8"), /- repo-sync exited 1\./);
});

test("dispatches past their lease ask the bot to tick", async () => {
  const status = JSON.stringify({ openDispatches: [{ id: 7, item: "a/b#1", kind: "ci", state: "sent", sessionHandle: "term_x", leaseUntil: 1 }] });
  const w = world({ FAKE_STATUS_OUT: status });
  assert.equal(await w.go(), EXIT.feed);
  assert.match(readFileSync(w.out().trim(), "utf8"), /## prflow dispatches due \(1\)\n\n- a\/b#1 ci #7 \| sent \| session term_x/);
});

test("unreadable prflow status is a failure entry", async () => {
  const w = world({ FAKE_STATUS_OUT: "not json" });
  assert.equal(await w.go(), EXIT.feed);
  assert.match(readFileSync(w.out().trim(), "utf8"), /- prflow status: unreadable reply/);
});

test("a slow tool is left running and reported, not killed", async () => {
  const w = world({ FAKE_SYNC_SLEEP: "1500", FAKE_SYNC_OUT: "late\n" });
  const t0 = Date.now();
  assert.equal(await w.go({ timeoutMs: 300 }), EXIT.feed);
  assert.ok(Date.now() - t0 < 1400, "tick returned at the deadline");
  const feed = readFileSync(w.out().trim(), "utf8");
  assert.match(feed, /- repo-sync was still running at the precheck deadline; it was left to finish\. Output so far: (\S+repo-sync\.out)/);
  const outFile = /Output so far: (\S+), errors/.exec(feed)?.[1] ?? "";
  await new Promise((r) => setTimeout(r, 1800));
  assert.equal(readFileSync(outFile, "utf8"), "late\n", "the abandoned tool finished and its output landed in its file");
});

test("a live lock skips without changing the matching run directory", async () => {
  const w = world();
  const runDir = join(w.opts.stateDir, "runs", "2026-11-20T20-30-00-000Z");
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "marker"), "keep");
  const lock = join(w.opts.stateDir, "lock");
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.parse("2026-11-20T20:30:00.000Z") }));
  assert.equal(await w.go(), EXIT.busy);
  assert.match(w.err(), /another tick is running/);
  assert.equal(readFileSync(join(runDir, "marker"), "utf8"), "keep");
  assert.equal(w.calls().length, 0);
});

test("a live lock skips with 75; a dead holder is taken over", async () => {
  const w = world({ FAKE_WATCH_OUT: "x\n" });
  const lock = join(w.opts.stateDir, "lock");
  await w.go();
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.parse("2026-11-20T20:40:00.000Z") }));
  assert.equal(await w.go(), EXIT.busy);
  assert.match(w.err(), /another tick is running/);
  assert.equal(readFileSync(lock, "utf8").includes(String(process.pid)), true, "the live lock is kept");
  writeFileSync(lock, JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now() }));
  assert.equal(await w.go(), EXIT.feed);
});

test("a tick does not remove a lock replaced while its tools run", async () => {
  const replacement = JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now() });
  const w = world({ FAKE_STATUS_REPLACEMENT: replacement, FAKE_WATCH_OUT: "x\n" });
  const lock = join(w.opts.stateDir, "lock");
  w.opts.env.FAKE_STATUS_REPLACE_LOCK = lock;
  assert.equal(await w.go(), EXIT.feed);
  assert.equal(readFileSync(lock, "utf8"), replacement);
});

test("a lock without content is judged by its file age", async () => {
  const w = world({ FAKE_WATCH_OUT: "x\n" });
  const lock = join(w.opts.stateDir, "lock");
  await w.go();
  writeFileSync(lock, "");
  assert.equal(await w.go({ now: Date.now }), EXIT.busy, "a just-created empty lock belongs to a tick still writing it");
  const old = new Date(Date.now() - 31 * 60 * 1000);
  utimesSync(lock, old, old);
  assert.equal(await w.go({ now: Date.now }), EXIT.feed);
});

test("only the newest feeds and run outputs are kept", async () => {
  const w = world({ FAKE_WATCH_OUT: "x\n" });
  for (let i = 0; i < 5; i++) assert.equal(await w.go(), EXIT.feed);
  assert.equal(readdirSync(join(w.opts.stateDir, "feed")).length, 3);
  assert.equal(readdirSync(join(w.opts.stateDir, "runs")).length, 3);
});

test("parseOptions defaults resolve the sibling skills and the XDG state dir", () => {
  const here = "/repo/skills/agent/orca-orchestrator/scripts";
  const o = parseOptions([], { XDG_STATE_HOME: "/xdg" }, here);
  assert.equal(o.stateDir, "/xdg/orca-orchestrator");
  assert.equal(o.prflow, "/repo/skills/workflow/prflow/scripts/prflow.ts");
  assert.equal(o.repoSync, "/repo/skills/workflow/repo-sync/scripts/repo-sync.ts");
  assert.equal(o.keep, 200);
  assert.equal(o.timeoutMs, 150_000);
  assert.throws(() => parseOptions(["--keep", "0"], {}, here), /--keep/);
  assert.throws(() => parseOptions(["--watch-name", "a b"], {}, here), /--watch-name/);
  assert.throws(() => parseOptions(["extra"], {}, here), /unexpected argument/);
});

test("the CLI prints the feed path and uses the exit contract", async () => {
  const w = world({ FAKE_WATCH_OUT: "x\n" });
  const res = await new Promise<{ code: number; stdout: string }>((done) => {
    const c = execFile(process.execPath, [TICK, "--state-dir", w.opts.stateDir, "--prflow", w.opts.prflow, "--repo-sync", w.opts.repoSync], { env: w.opts.env }, (e, stdout) => done({ code: e ? Number((e as { code?: number }).code) : 0, stdout }));
    c.stdin?.end();
  });
  assert.equal(res.code, 0);
  assert.match(res.stdout, /feed\/.*\.txt\n$/);
});
