import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { blockedStatePath, putBlocked, readBlocked } from "../../../../lib/blocked.ts";
import { main, slugFromRemote, type Io } from "../scripts/task-status.ts";
import type { CmdResult } from "../../../../lib/runtime.ts";
import { DEFAULT_STATUSES } from "../scripts/config.ts";

const HEAD = "a".repeat(40);
const STATUSES = { ...DEFAULT_STATUSES, paused: "status-paused", blocked: "status-blocked", "needs-attention": "status-attn" };

const stateDirs: string[] = [];
after(() => { for (const d of stateDirs) rmSync(d, { recursive: true, force: true }); });

const BLOCK = ["--reason", "waiting for acme/api#3", "--until", "pr-merged acme/api#3", "--until", "checks-pass"];

interface World {
  status?: string;
  comment?: string;
  isMain?: boolean;
  branch?: string;
  dirty?: boolean;
  head?: string;
  pr?: Record<string, unknown> | null;
  current?: CmdResult;
  rm?: CmdResult;
}

function harness(world: World) {
  const calls: string[][] = [];
  let out = "";
  let err = "";
  const ok = (stdout: string): CmdResult => ({ ok: true, stdout, stderr: "" });
  const state = mkdtempSync(join(tmpdir(), "task-status-test-"));
  stateDirs.push(state);
  const io: Io = {
    env: { ORCA_CLI_COMMAND: "orca", XDG_STATE_HOME: state },
    cwd: "/w/t/sub",
    config: { accounts: [], statuses: STATUSES },
    out: (s) => { out += s; },
    err: (s) => { err += s; },
    run: async (cmd, args) => {
      calls.push([cmd, ...args]);
      const key = [cmd, ...args].join(" ");
      if (key === "git rev-parse --show-toplevel") return ok("/w/t\n");
      if (key === "git status --porcelain") return ok(world.dirty ? " M x\n" : "");
      if (key === "git rev-parse HEAD") return ok(`${world.head ?? HEAD}\n`);
      if (key === "git remote get-url origin") return ok("git@github.com-work:acme/widgets.git\n");
      if (key === "orca worktree current --json") {
        if (world.current) return world.current;
        return ok(JSON.stringify({ ok: true, result: { worktree: {
          id: "r::/w/t", path: "/w/t", branch: `refs/heads/${world.branch ?? "feat/x"}`, isMainWorktree: world.isMain ?? false,
          workspaceStatus: world.status ?? "todo", comment: world.comment ?? "", childWorktreeIds: [],
        } } }));
      }
      if (cmd === "orca" && args[1] === "set") return ok('{"ok":true}');
      if (cmd === "orca" && args[1] === "rm") return world.rm ?? ok('{"ok":true}');
      if (cmd === "gh" && args[0] === "pr") {
        if (world.pr === null || world.pr === undefined) return { ok: false, stdout: "", stderr: 'no pull requests found for branch "feat/x"' };
        return ok(JSON.stringify({ number: 7, state: "OPEN", isDraft: false, mergedAt: null, reviewDecision: "", mergeStateStatus: "CLEAN", headRefOid: HEAD, statusCheckRollup: [], ...world.pr }));
      }
      throw new Error(`unexpected call: ${key}`);
    },
  };
  return { io, calls, out: () => out, err: () => err, records: () => readBlocked(blockedStatePath(io.env)).records };
}

const sets = (calls: string[][]) => calls.filter((c) => c[0] === "orca" && c[2] === "set").map((c) => c[c.indexOf("--workspace-status") + 1]);
const removed = (calls: string[][]) => calls.some((c) => c[0] === "orca" && c[2] === "rm");

test("start sets In Progress on this worktree by id", async () => {
  const h = harness({ status: "todo" });
  assert.equal(await main(["start"], h.io), 0);
  const set = h.calls.find((c) => c[2] === "set")!;
  assert.deepEqual(set, ["orca", "worktree", "set", "--worktree", "id:r::/w/t", "--workspace-status", "in-progress", "--json"]);
  assert.match(h.out(), /todo -> in-progress/);
});

test("an unchanged status makes no write", async () => {
  const h = harness({ status: "in-progress" });
  assert.equal(await main(["start"], h.io), 0);
  assert.deepEqual(sets(h.calls), []);
  assert.match(h.out(), /unchanged/);
});

test("Paused is kept unless the agent resumes", async () => {
  const kept = harness({ status: "status-paused" });
  assert.equal(await main(["start"], kept.io), 0);
  assert.deepEqual(sets(kept.calls), []);
  assert.match(kept.out(), /kept paused/);
  const resumed = harness({ status: "status-paused" });
  assert.equal(await main(["start", "--resume"], resumed.io), 0);
  assert.deepEqual(sets(resumed.calls), ["in-progress"]);
});

test("end maps the outcome and PR to a status", async () => {
  const cases: [string[], World, string][] = [
    [["end"], { pr: null }, "status-attn"],
    [["end"], { pr: { statusCheckRollup: [{ __typename: "CheckRun", status: "QUEUED", conclusion: "" }] } }, "in-review"],
    [["end"], { pr: {} }, "completed"],
    [["end", "--outcome", "blocked", ...BLOCK], {}, "status-blocked"],
    [["end", "--outcome", "needs-input"], {}, "status-attn"],
    [["end", "--outcome", "paused"], {}, "status-paused"],
  ];
  for (const [argv, world, want] of cases) {
    const h = harness({ status: "in-progress", ...world });
    assert.equal(await main(argv, h.io), 0, `${argv.join(" ")}: ${h.err()}`);
    assert.deepEqual(sets(h.calls), [want], argv.join(" "));
  }
});

test("end reads the PR with the branch and repo slug and never removes", async () => {
  const h = harness({ status: "in-progress", pr: { state: "MERGED", mergedAt: "2026-01-01T00:00:00Z" } });
  assert.equal(await main(["end"], h.io), 0);
  const gh = h.calls.find((c) => c[0] === "gh")!;
  assert.deepEqual(gh.slice(0, 3), ["gh", "pr", "view"]);
  assert.equal(gh[3], "feat/x");
  assert.equal(gh[gh.indexOf("--repo") + 1], "acme/widgets");
  assert.equal(removed(h.calls), false);
  assert.match(h.out(), /cleanup: eligible/);
});

test("end reports why a merged worktree is not eligible for cleanup", async () => {
  const h = harness({ status: "in-progress", dirty: true, pr: { state: "MERGED", mergedAt: "2026-01-01T00:00:00Z" } });
  assert.equal(await main(["end"], h.io), 0);
  assert.match(h.out(), /cleanup: not eligible \(uncommitted/);
});

test("cleanup removes a merged, clean worktree by id without --force", async () => {
  const h = harness({ status: "in-progress", pr: { state: "MERGED", mergedAt: "2026-01-01T00:00:00Z" } });
  assert.equal(await main(["cleanup"], h.io), 0, h.err());
  assert.deepEqual(sets(h.calls), ["completed"]);
  const rm = h.calls.find((c) => c[2] === "rm")!;
  assert.deepEqual(rm, ["orca", "worktree", "rm", "--worktree", "id:r::/w/t", "--json"]);
});

test("cleanup refuses unmerged, dirty, unpushed, or paused worktrees", async () => {
  const merged = { state: "MERGED", mergedAt: "2026-01-01T00:00:00Z" };
  const cases: World[] = [
    { pr: null },
    { pr: {} },
    { pr: merged, dirty: true },
    { pr: merged, head: "b".repeat(40) },
    { pr: merged, status: "status-paused" },
  ];
  for (const world of cases) {
    const h = harness({ status: "in-progress", ...world });
    assert.equal(await main(["cleanup"], h.io), 1, JSON.stringify(world));
    assert.equal(removed(h.calls), false);
    assert.match(h.out(), /cleanup refused/);
  }
});

test("skips outside Orca, in main checkouts, in prflow review worktrees, and when disabled", async () => {
  const outside = harness({ current: { ok: false, stdout: '{"ok":false,"error":{"code":"selector_not_found"}}', stderr: "" } });
  assert.equal(await main(["start"], outside.io), 0);
  assert.match(outside.out(), /skipped: outside an Orca worktree/);
  const missing = harness({ current: { ok: false, stdout: "", stderr: "spawn orca ENOENT" } });
  assert.equal(await main(["cleanup"], missing.io), 0);
  assert.match(missing.out(), /skipped: Orca unavailable/);
  const broken = harness({ current: { ok: false, stdout: "", stderr: "runtime_unavailable" } });
  assert.equal(await main(["start"], broken.io), 1);
  assert.match(broken.err(), /orca worktree current failed: runtime_unavailable/);
  const main_ = harness({ isMain: true });
  assert.equal(await main(["cleanup"], main_.io), 0);
  assert.equal(removed(main_.calls), false);
  assert.match(main_.out(), /main checkout/);
  const review = harness({ branch: "prflow-review/acme-7" });
  assert.equal(await main(["start"], review.io), 0);
  assert.deepEqual(sets(review.calls), []);
  const off = harness({});
  off.io.env.ORCA_TASK_STATUS = "0";
  assert.equal(await main(["start"], off.io), 0);
  assert.deepEqual(off.calls, []);
});

test("a state with no configured id fails without writing", async () => {
  const h = harness({ status: "in-progress" });
  h.io.config = { accounts: [], statuses: { ...DEFAULT_STATUSES } };
  assert.equal(await main(["end", "--outcome", "blocked", ...BLOCK], h.io), 1);
  assert.deepEqual(sets(h.calls), []);
  assert.match(h.err(), /taskStatus\.statuses\.blocked/);
});

test("bad usage exits 2", async () => {
  assert.equal(await main(["set", "todo"], harness({}).io), 2);
  assert.equal(await main(["end", "--outcome", "x"], harness({}).io), 2);
  assert.equal(await main(["nope"], harness({}).io), 2);
});

test("slugFromRemote reads owner/repo from GitHub remotes and host aliases", () => {
  assert.equal(slugFromRemote("git@github.com-work:acme/widgets.git"), "acme/widgets");
  assert.equal(slugFromRemote("https://github.com/acme/widgets"), "acme/widgets");
  assert.equal(slugFromRemote("ssh://git@github.com/acme/widgets.git"), "acme/widgets");
});

test("blocked refuses without a reason or an unblock condition", async () => {
  const cases: string[][] = [
    ["end", "--outcome", "blocked"],
    ["end", "--outcome", "blocked", "--until", "checks-pass"],
    ["end", "--outcome", "blocked", "--reason", "waiting"],
    ["set", "blocked", "--reason", "  ", "--until", "checks-pass"],
    ["set", "blocked", "--reason", "waiting", "--until", "soon"],
    ["set", "blocked", "--reason", "waiting", "--until", "pr-merged acme/api"],
    ["set", "blocked", "--reason", "waiting", "--until", "manual", "--until", "checks-pass"],
    ["set", "blocked", "--reason", "two\nlines", "--until", "manual"],
    ["start", "--reason", "x"],
    ["end", "--until", "checks-pass"],
    ["set", "blocked", "--reason", "waiting for CI", "--until", "checks-pass"],
  ];
  for (const argv of cases) {
    const h = harness({ status: "in-progress" });
    assert.equal(await main(argv, h.io), 2, argv.join(" "));
    assert.deepEqual(h.calls, [], argv.join(" "));
  }
});

test("end --outcome blocked that only waits for CI derives In Review from the PR and records nothing", async () => {
  const h = harness({ status: "in-progress", pr: { statusCheckRollup: [{ __typename: "CheckRun", status: "QUEUED", conclusion: "" }] } });
  assert.equal(await main(["end", "--outcome", "blocked", "--reason", "waiting for CI", "--until", "checks-pass"], h.io), 0, h.err());
  assert.deepEqual(sets(h.calls), ["in-review"]);
  assert.match(h.out(), /waiting for CI is In Review, not Blocked/);
  assert.deepEqual(h.records(), {});
});

test("blocked writes the record and the card comment in one status write", async () => {
  const h = harness({ status: "in-progress", pr: {} });
  assert.equal(await main(["end", "--outcome", "blocked", ...BLOCK], h.io), 0, h.err());
  const set = h.calls.find((c) => c[2] === "set")!;
  assert.deepEqual(set, ["orca", "worktree", "set", "--worktree", "id:r::/w/t", "--workspace-status", "status-blocked",
    "--comment", "Blocked: waiting for acme/api#3 · until: pr-merged acme/api#3, checks-pass", "--json"]);
  assert.match(h.out(), /in-progress -> blocked \(waiting for acme\/api#3; until: pr-merged acme\/api#3, checks-pass\)/);
  const rec = h.records()["r::/w/t"]!;
  assert.deepEqual({ ...rec, setAt: "" }, {
    worktreeId: "r::/w/t", path: "/w/t", branch: "feat/x", repo: "acme/widgets", pr: 7,
    reason: "waiting for acme/api#3", conditions: ["pr-merged acme/api#3", "checks-pass"], setAt: "",
  });
  assert.ok(!Number.isNaN(Date.parse(rec.setAt)));
});

test("set blocked accepts pr-merged=<ref> and records no PR when the branch has none", async () => {
  const h = harness({ status: "in-progress", pr: null });
  assert.equal(await main(["set", "blocked", "--reason", "needs a human", "--until", "manual"], h.io), 0, h.err());
  assert.deepEqual(h.records()["r::/w/t"]?.conditions, ["manual"]);
  assert.equal(h.records()["r::/w/t"]?.pr, null);
  const eq = harness({ status: "in-progress", pr: null });
  assert.equal(await main(["set", "blocked", "--reason", "dep", "--until", "pr-merged=acme/api#3"], eq.io), 0, eq.err());
  assert.deepEqual(eq.records()["r::/w/t"]?.conditions, ["pr-merged acme/api#3"]);
});

test("re-blocking an already Blocked card updates its comment and record", async () => {
  const h = harness({ status: "status-blocked", comment: "Blocked: old · until: manual", pr: {} });
  assert.equal(await main(["set", "blocked", ...BLOCK], h.io), 0, h.err());
  assert.deepEqual(sets(h.calls), ["status-blocked"]);
  assert.match(h.out(), /updated blocked/);
  assert.equal(h.records()["r::/w/t"]?.reason, "waiting for acme/api#3");
});

test("leaving Blocked removes the record and clears only a Blocked comment", async () => {
  const h = harness({ status: "status-blocked", comment: "Blocked: x · until: manual" });
  putBlocked(blockedStatePath(h.io.env), { worktreeId: "r::/w/t", path: "/w/t", branch: "feat/x", repo: null, pr: null, reason: "x", conditions: ["manual"], setAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(await main(["start"], h.io), 0, h.err());
  const set = h.calls.find((c) => c[2] === "set")!;
  assert.deepEqual(set.slice(5), ["--workspace-status", "in-progress", "--comment", "", "--json"]);
  assert.deepEqual(h.records(), {});
  const other = harness({ status: "status-blocked", comment: "my own note" });
  assert.equal(await main(["start"], other.io), 0);
  assert.equal(other.calls.find((c) => c[2] === "set")!.includes("--comment"), false);
});

test("a failed Blocked write leaves no record, and a kept Paused card gets none", async () => {
  const h = harness({ status: "in-progress", pr: {} });
  const run = h.io.run;
  h.io.run = async (cmd, args, opts) => (cmd === "orca" && args[1] === "set" ? { ok: false, stdout: "", stderr: "boom" } : run(cmd, args, opts));
  assert.equal(await main(["set", "blocked", ...BLOCK], h.io), 1);
  assert.deepEqual(h.records(), {});
  const paused = harness({ status: "status-paused", pr: {} });
  assert.equal(await main(["end", "--outcome", "blocked", ...BLOCK], paused.io), 0);
  assert.match(paused.out(), /kept paused/);
  assert.deepEqual(paused.records(), {});
});

test("show prints the blocked record", async () => {
  const h = harness({ status: "status-blocked", pr: {} });
  putBlocked(blockedStatePath(h.io.env), { worktreeId: "r::/w/t", path: "/w/t", branch: "feat/x", repo: null, pr: 7, reason: "dep", conditions: ["checks-pass"], setAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(await main(["show"], h.io), 0, h.err());
  assert.match(h.out(), /blocked record: dep · until: checks-pass/);
});
