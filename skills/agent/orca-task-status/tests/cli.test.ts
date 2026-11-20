import assert from "node:assert/strict";
import test from "node:test";
import { main, slugFromRemote, type Io } from "../scripts/task-status.ts";
import type { CmdResult } from "../../../../lib/runtime.ts";
import { DEFAULT_STATUSES } from "../scripts/config.ts";

const HEAD = "a".repeat(40);
const STATUSES = { ...DEFAULT_STATUSES, paused: "status-paused", blocked: "status-blocked", "needs-attention": "status-attn" };

interface World {
  status?: string;
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
  const io: Io = {
    env: { ORCA_CLI_COMMAND: "orca" },
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
          workspaceStatus: world.status ?? "todo", childWorktreeIds: [],
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
  return { io, calls, out: () => out, err: () => err };
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
    [["end", "--outcome", "blocked"], {}, "status-blocked"],
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
  assert.equal(await main(["end", "--outcome", "blocked"], h.io), 1);
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
