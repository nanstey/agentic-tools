import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { main, type Io } from "../scripts/cli.ts";
import type { Deps } from "../scripts/deps.ts";
import { err, fakeDeps, ok, scriptRepo } from "./fixtures.ts";

const root = mkdtempSync(join(tmpdir(), "repo-sync-cli-"));
after(() => rmSync(root, { recursive: true, force: true }));
let n = 0;

/** Fresh state and config dirs per test; no default config file exists in them. */
function setup() {
  const dir = join(root, String(n++));
  const env = { XDG_STATE_HOME: join(dir, "state"), XDG_CONFIG_HOME: join(dir, "config"), AGENTIC_TOOLS_CONFIG: join(dir, "config.json") };
  mkdirSync(dir, { recursive: true });
  writeFileSync(env.AGENTIC_TOOLS_CONFIG, JSON.stringify({ accounts: [], repoSync: { reportChanges: ["reported"] } }));
  return { dir, env, state: join(env.XDG_STATE_HOME, "repo-sync") };
}

const LIST = (paths: string[]) =>
  JSON.stringify({ ok: true, result: { repos: paths.map((p) => ({ id: p, path: p, displayName: p.split("/").at(-1), kind: "git", executionHostId: "local", gitRemoteIdentity: { remoteName: "origin", remoteUrl: `git@github.com:me/${p.split("/").at(-1)}.git` } })) } });

async function cli(args: string[], deps: Deps, env: NodeJS.ProcessEnv, extra: Partial<Io> = {}) {
  let out = "";
  let errText = "";
  const code = await main(args, { deps, env, now: () => Date.parse("2026-01-01T00:00:00Z"), out: (s) => (out += s), err: (s) => (errText += s), ...extra });
  return { code, out, err: errText };
}

describe("repo-sync run", () => {
  it("prints nothing on quiet success, then reports a stuck checkout on its second run, and writes state", async () => {
    const { env, state } = setup();
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, "last-run.json"), "{");
    const script = { ...scriptRepo("/r/clean", { counts: [0, 1] }), ...scriptRepo("/r/dirty", { status: " M a\n" }) };
    const { deps } = fakeDeps(script, { list: ok(LIST(["/r/clean", "/r/dirty"])) });
    const first = await cli(["run"], deps, env);
    assert.deepEqual([first.code, first.out, first.err], [0, "", ""]);
    const { deps: deps2 } = fakeDeps({ ...scriptRepo("/r/clean", { counts: [0, 0] }), ...scriptRepo("/r/dirty", { status: " M a\n" }) }, { list: ok(LIST(["/r/clean", "/r/dirty"])) });
    const second = await cli(["run"], deps2, env);
    assert.equal(second.out, "dirty: skipped (dirty) for 2 runs: 1 changed path\n");
    const last = JSON.parse(readFileSync(join(state, "last-run.json"), "utf8"));
    assert.equal(last.repos["/r/dirty"].streak, 2);
    assert.equal(last.repos["/r/clean"].status, "up-to-date");
    const events = readFileSync(join(state, "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).kind);
    assert.deepEqual(events, ["updated", "skipped", "run", "run"]);
    assert.ok(existsSync(join(state, "repos.json")));
    assert.ok(!existsSync(join(state, "lock")), "lock released");
    const status = await cli(["status"], deps2, env);
    assert.match(status.out, /dirty  skipped \(dirty\)  1 changed path  \(2 runs\)/);
  });

  it("reports pulls in reportChanges repos", async () => {
    const { env } = setup();
    const { deps } = fakeDeps(scriptRepo("/r/reported"), { list: ok(LIST(["/r/reported"])) });
    const r = await cli(["run"], deps, env);
    assert.equal(r.out, "reported: pulled 2 commits on main (aaaaaaa..bbbbbbb)\n  b1 two\n  b0 one\n  changed paths (2):\n    README.md\n    src/a.ts\n");
  });

  it("exits 0 silently while another live run holds the lock", async () => {
    const { env, state } = setup();
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, "lock"), JSON.stringify({ pid: process.pid }));
    const { deps, calls } = fakeDeps({}, { list: err("must not be called") });
    const r = await cli(["run"], deps, env);
    assert.deepEqual([r.code, r.out, r.err, calls.length], [0, "", "", 0]);
    assert.ok(existsSync(join(state, "lock")), "the other run's lock is kept");
  });

  it("takes over a stale lock: dead pid or older than 30 minutes", async () => {
    for (const kind of ["dead", "old"]) {
      const { env, state } = setup();
      mkdirSync(state, { recursive: true });
      const lock = join(state, "lock");
      writeFileSync(lock, JSON.stringify({ pid: 4242 }));
      if (kind === "old") utimesSync(lock, new Date("2025-12-31T23:00:00Z"), new Date("2025-12-31T23:00:00Z"));
      const { deps, calls } = fakeDeps(scriptRepo("/r/a", { counts: [0, 0] }), { list: ok(LIST(["/r/a"])) });
      const r = await cli(["run"], deps, env, { alive: (pid) => kind === "old" && pid === 4242 });
      assert.equal(r.code, 0);
      assert.ok(calls.length > 0, `${kind} lock taken over`);
      assert.ok(!existsSync(lock));
    }
  });

  it("pause stops runs silently until resume", async () => {
    const { env, state } = setup();
    const { deps, calls } = fakeDeps(scriptRepo("/r/a", { counts: [0, 0] }), { list: ok(LIST(["/r/a"])) });
    assert.equal((await cli(["pause", "--reason", "travel"], deps, env)).out, "repo-sync paused\n");
    const paused = await cli(["run"], deps, env);
    assert.deepEqual([paused.code, paused.out, calls.length], [0, "", 0]);
    assert.ok(!existsSync(join(state, "last-run.json")));
    assert.match((await cli(["status"], deps, env)).out, /^paused: travel\nno runs yet/);
    assert.equal((await cli(["resume"], deps, env)).out, "repo-sync resumed\n");
    await cli(["run"], deps, env);
    assert.ok(calls.length > 0);
  });

  it("dry run reports every repo and writes no state", async () => {
    const { env, state } = setup();
    const { deps, calls } = fakeDeps({ ...scriptRepo("/r/a", { counts: [0, 3] }), ...scriptRepo("/r/b", { current: "feat" }) }, { list: ok(LIST(["/r/a", "/r/b"])) });
    const r = await cli(["run", "--dry-run"], deps, env);
    assert.equal(r.code, 0);
    assert.equal(r.out, "repo-sync dry run: no fetch, no merge, no state written\na  would-update  3 behind as of last fetch  [ssh]\nb  skipped (not-on-default)  on feat, default main  [ssh]\n");
    assert.ok(!calls.some((c) => c.args[0] === "fetch" || c.args[0] === "merge"));
    assert.ok(!existsSync(state), "no state dir");
  });

  it("falls back to the cached repo list when Orca cannot answer, else exits 1", async () => {
    const { env } = setup();
    const { deps } = fakeDeps(scriptRepo("/r/a", { counts: [0, 0] }), { list: err("orca is not running") });
    const none = await cli(["run"], deps, env);
    assert.equal(none.code, 1);
    assert.match(none.err, /cannot list Orca repos: orca is not running/);
    const { deps: good } = fakeDeps(scriptRepo("/r/a", { counts: [0, 0] }), { list: ok(LIST(["/r/a"])) });
    await cli(["run"], good, env);
    const cached = await cli(["run"], deps, env);
    assert.deepEqual([cached.code, cached.out], [0, ""]);
    assert.match(cached.err, /using the cached list/);
  });

  it("exits 1 on an invalid config, 2 on usage errors", async () => {
    const { env } = setup();
    writeFileSync(env.AGENTIC_TOOLS_CONFIG, '{"accounts": "x"}');
    const { deps } = fakeDeps({});
    const r = await cli(["run"], deps, env);
    assert.equal(r.code, 1);
    assert.match(r.err, /accounts must be an array/);
    assert.equal((await cli(["nope"], deps, env)).code, 2);
    assert.equal((await cli(["--help"], deps, env)).code, 0);
  });
});

describe("repo-sync entrypoint", () => {
  it("runs as a child process with a fake orca-ide on PATH", () => {
    const { dir, env, state } = setup();
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const list = join(dir, "list.json");
    writeFileSync(list, LIST([join(dir, "missing-checkout")]));
    writeFileSync(join(bin, "orca-ide"), `#!/bin/sh\n[ "$1 $2 $3" = "repo list --json" ] || exit 9\ncat '${list}'\n`);
    chmodSync(join(bin, "orca-ide"), 0o755);
    const out = execFileSync(process.execPath, [join(import.meta.dirname, "..", "scripts", "repo-sync.ts"), "run", "--dry-run"], {
      env: { ...process.env, ...env, PATH: `${bin}:${process.env.PATH}` },
      encoding: "utf8",
    });
    assert.match(out, /^repo-sync dry run/);
    assert.match(out, /missing-checkout  failed \(error\)/);
    assert.ok(!existsSync(state));
  });
});

describe("lock", () => {
  it("unlock preserves a lock whose content changed after acquisition", async () => {
    const { Store } = await import("../scripts/store.ts");
    const { state } = setup();
    const store = new Store(state);
    store.ensureDir();
    assert.equal(store.tryLock(Date.parse("2026-01-01T00:00:00Z")), true);
    const lock = join(state, "lock");
    const owner = JSON.stringify({ pid: 4343 });
    writeFileSync(lock, owner);
    store.unlock();
    assert.equal(readFileSync(lock, "utf8"), owner);
  });

  it("corrupt last-run state reads as empty", async () => {
    const { Store } = await import("../scripts/store.ts");
    const { state } = setup();
    const store = new Store(state);
    store.ensureDir();
    writeFileSync(join(state, "last-run.json"), "{");
    assert.equal(store.readLast(), null);
  });

  it("does not remove a lock that another run replaced after the stale check", async () => {
    const { Store } = await import("../scripts/store.ts");
    const { state } = setup();
    const store = new Store(state);
    store.ensureDir();
    const lock = join(state, "lock");
    writeFileSync(lock, JSON.stringify({ pid: 4242 }));
    // The liveness check runs between reading the stale lock and removing it; simulate another run taking over then.
    const taken = store.tryLock(Date.parse("2026-01-01T00:00:00Z"), () => {
      writeFileSync(lock, JSON.stringify({ pid: 4343 }));
      return false;
    });
    assert.equal(taken, false);
    assert.equal(JSON.parse(readFileSync(lock, "utf8")).pid, 4343, "the other run's lock is kept");
  });
});
