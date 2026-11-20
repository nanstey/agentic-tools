import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BlockedRecord } from "../../../../lib/blocked.ts";
import { assertOrca, taskStatusSetArgs } from "../scripts/adapters/orca.ts";
import { DEFAULT_STATUSES, type Config } from "../scripts/core/config.ts";
import type { Store } from "../scripts/store.ts";
import { tick } from "../scripts/tick.ts";
import { makeUnblock } from "../scripts/unblock.ts";
import { HEAD, ok, prResponse, run } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, okJson, tempStore, world, type World } from "./state-helpers.ts";

const STATUSES = { ...DEFAULT_STATUSES, blocked: "status-6", paused: "status-6-2", "needs-attention": "status-7" };
const ID = "repo1::/w/feat";
const SET_AT = "2026-01-12T16:00:00.000Z";

const config = (over: Partial<Config> = {}): Config => ({ ...cfg({}, true), taskStatuses: STATUSES, ...over });

const row = (over: Record<string, unknown> = {}) => ({
  id: ID, path: "/w/feat", branch: "refs/heads/feat", projectId: "github:Acme/widgets", linkedPR: 1, workspaceStatus: "status-6", comment: "Blocked: x", ...over,
});

const record = (conditions: string[], over: Partial<BlockedRecord> = {}): BlockedRecord => ({
  worktreeId: ID, path: "/w/feat", branch: "feat", repo: "Acme/widgets", pr: 1, reason: "waiting on CI", conditions, setAt: SET_AT, ...over,
});

function blockedWorld(conditions: string[] | null, over: Partial<World> = {}): World {
  return world({
    worktrees: [row()],
    prs: { "Acme/widgets#1": prResponse() },
    worktreeHeads: { "/w/feat": HEAD },
    blocked: { version: 1, records: conditions ? { [ID]: record(conditions) } : {} },
    ...over,
  });
}

async function runTick(w: World, s: Store, o: { dryRun?: boolean; config?: Config } = {}) {
  const c = o.config ?? config();
  const deps = fakeTickDeps(w);
  const unblock = makeUnblock(deps, s, c);
  const out = await tick(deps, s, c, { dryRun: o.dryRun ?? false }, { act: async (ctx, _r, _i, opts) => unblock(ctx, opts) });
  w.clock += 15 * MIN;
  return out;
}

const statusWrites = (w: World) => w.effects.filter((e) => e.startsWith("task-status"));

describe("unblock", () => {
  it("moves a card out once checks pass, to the PR-derived state, with a comment and an unblocked event", async () => {
    const w = blockedWorld(["checks-pass"]);
    const s = tempStore();
    const out = await runTick(w, s);
    assert.equal(out.exitCode, 0, out.stderr);
    assert.deepEqual(statusWrites(w), [`task-status ${ID} completed unblocked: checks passed at c0ffee11`]);
    assert.ok(w.effects.includes(`clear-blocked ${ID}`));
    assert.deepEqual(w.blocked?.records, {});
    assert.match(out.stdout, /dispatched Acme\/widgets#1 unblock #1: move \/w\/feat: blocked -> done \(PR #1 is ready to merge\)/);
    assert.match(out.stdout, /unblocked Acme\/widgets#1 unblock #1: \/w\/feat: blocked -> done \(PR #1 is ready to merge\); unblocked: checks passed at c0ffee11/);
    assert.equal(s.findDispatch("Acme/widgets#1", `blocked@${SET_AT}`, "unblock")?.state, "done");
    // The card left Blocked; nothing more happens.
    w.effects.length = 0;
    assert.doesNotMatch((await runTick(w, s)).stdout, /unblock/);
    assert.deepEqual(w.effects, []);
  });

  it("moves a card that only waits for CI to In Review at once: waiting for CI is not Blocked", async () => {
    const pending = blockedWorld(["checks-pass"], { prs: { "Acme/widgets#1": prResponse({ checks: [run("build", "IN_PROGRESS", null, undefined, true)] }) } });
    await runTick(pending, tempStore());
    assert.deepEqual(statusWrites(pending), [`task-status ${ID} in-review unblocked: PR #1 checks pending; waiting for CI is In Review, not Blocked`]);
    const optional = blockedWorld(["checks-pass"], { prs: { "Acme/widgets#1": prResponse({ checks: [ok("build", true), run("lint", "COMPLETED", "FAILURE")] }) } });
    await runTick(optional, tempStore());
    // Required checks passed, but the PR-derived rules see the failing check: Needs Attention.
    assert.deepEqual(statusWrites(optional), [`task-status ${ID} status-7 unblocked: checks passed at c0ffee11`]);
  });

  it("waits on checks-pass while another condition is unmet", async () => {
    const view = "pr view 3 -R Acme/api --json state";
    const w = blockedWorld(["pr-merged Acme/api#3", "checks-pass"], {
      prs: { "Acme/widgets#1": prResponse({ checks: [run("build", "IN_PROGRESS", null, undefined, true)] }) },
      refs: { [view]: okJson({ state: "MERGED" }) },
    });
    await runTick(w, tempStore());
    assert.deepEqual(statusWrites(w), []);
  });

  it("uses the PR-derived rules for the target: a local HEAD that differs gives Needs Attention", async () => {
    const w = blockedWorld(["checks-pass"], { worktreeHeads: { "/w/feat": "b".repeat(40) } });
    await runTick(w, tempStore());
    assert.deepEqual(statusWrites(w), [`task-status ${ID} status-7 unblocked: checks passed at c0ffee11`]);
  });

  it("unblocks on pr-merged once the other PR merged, with no PR of its own", async () => {
    const view = "pr view 3 -R Acme/api --json state";
    const w = blockedWorld(null, {
      worktrees: [row({ linkedPR: null })],
      blocked: { version: 1, records: { [ID]: record(["pr-merged Acme/api#3"], { pr: null }) } },
      refs: { [view]: okJson({ state: "OPEN" }) },
    });
    const s = tempStore();
    await runTick(w, s);
    assert.deepEqual(statusWrites(w), []);
    w.refs[view] = okJson({ state: "MERGED" });
    const out = await runTick(w, s);
    assert.deepEqual(statusWrites(w), [`task-status ${ID} status-7 unblocked: Acme/api#3 merged`]);
    assert.match(out.stdout, /unblocked acme\/widgets@feat unblock/);
    assert.ok(w.calls.some((c) => c.join(" ") === `gh ${view}`));
  });

  it("reports a pr-merged target that closed unmerged once, and never moves it", async () => {
    const w = blockedWorld(["pr-merged Acme/api#3"], { refs: { "pr view 3 -R Acme/api --json state": okJson({ state: "CLOSED" }) } });
    const s = tempStore();
    assert.match((await runTick(w, s)).stdout, /needs-decision Acme\/widgets#1 unblock: blocked on a condition that can no longer hold: Acme\/api#3 closed without merging/);
    assert.doesNotMatch((await runTick(w, s)).stdout, /needs-decision/);
    assert.deepEqual(statusWrites(w), []);
  });

  it("unblocks on pr-approved only when the PR is approved", async () => {
    const w = blockedWorld(["pr-approved"], { prs: { "Acme/widgets#1": prResponse({ decision: "REVIEW_REQUIRED", merge: "BLOCKED" }) } });
    const s = tempStore();
    await runTick(w, s);
    assert.deepEqual(statusWrites(w), []);
    w.prs["Acme/widgets#1"] = prResponse();
    await runTick(w, s);
    assert.deepEqual(statusWrites(w), [`task-status ${ID} completed unblocked: PR #1 approved`]);
  });

  it("dry run announces the move once and writes nothing", async () => {
    const w = blockedWorld(["checks-pass"]);
    const s = tempStore();
    const out = await runTick(w, s, { dryRun: true });
    assert.match(out.stdout, /dry-run Acme\/widgets#1 unblock: would move \/w\/feat: blocked -> done/);
    assert.deepEqual(statusWrites(w), []);
    assert.deepEqual(Object.keys(w.blocked?.records ?? {}), [ID]);
    assert.doesNotMatch((await runTick(w, s, { dryRun: true })).stdout, /dry-run/);
  });

  it("reports a Blocked card with no record, or only manual, once as needs-decision and never moves it", async () => {
    const none = blockedWorld(null);
    const s = tempStore();
    assert.match((await runTick(none, s)).stdout, /needs-decision acme\/widgets#1 unblock: blocked with no unblock condition: \/w\/feat/);
    assert.doesNotMatch((await runTick(none, s)).stdout, /needs-decision/);
    assert.deepEqual(statusWrites(none), []);

    const manual = blockedWorld(["manual"]);
    const s2 = tempStore();
    assert.match((await runTick(manual, s2)).stdout, /needs-decision Acme\/widgets#1 unblock: blocked with no unblock condition \(manual\): waiting on CI/);
    assert.doesNotMatch((await runTick(manual, s2)).stdout, /needs-decision/);
    assert.deepEqual(statusWrites(manual), []);
  });

  it("never touches Paused cards, review worktrees, or other columns", async () => {
    const w = blockedWorld(["checks-pass"], {
      worktrees: [
        row({ workspaceStatus: "status-6-2" }),
        row({ id: "repo1::/w/prflow-review-widgets-1", path: "/w/prflow-review-widgets-1", branch: "refs/heads/prflow-review/widgets-1" }),
        row({ id: "repo1::/w/other", path: "/w/other", workspaceStatus: "in-progress" }),
      ],
    });
    const out = await runTick(w, tempStore());
    assert.deepEqual(statusWrites(w), []);
    assert.doesNotMatch(out.stdout, /needs-decision/);
  });

  it("skips a card that left Blocked before the write", async () => {
    const w = blockedWorld(["checks-pass"]);
    const s = tempStore();
    const c = config();
    const deps = fakeTickDeps(w);
    let reads = 0;
    const list = deps.orcaWorktrees;
    deps.orcaWorktrees = async () => {
      // Scan, unblock list, then the fresh check: the agent moved the card meanwhile.
      if (++reads === 3) (w.worktrees[0] as { workspaceStatus: string }).workspaceStatus = "in-progress";
      return list();
    };
    const unblock = makeUnblock(deps, s, c);
    await tick(deps, s, c, { dryRun: false }, { act: async (ctx, _r, _i, opts) => unblock(ctx, opts) });
    assert.deepEqual(statusWrites(w), []);
    assert.equal(s.findDispatch("Acme/widgets#1", `blocked@${SET_AT}`, "unblock")?.detail, "/w/feat already left Blocked");
  });

  it("treats a record from another branch of the same worktree as no record", async () => {
    const w = blockedWorld(null, { blocked: { version: 1, records: { [ID]: record(["checks-pass"], { branch: "old" }) } } });
    assert.match((await runTick(w, tempStore())).stdout, /needs-decision acme\/widgets#1 unblock: blocked with no unblock condition/);
    assert.deepEqual(statusWrites(w), []);
  });

  it("skips the write when the card was re-blocked with new conditions during the tick", async () => {
    const w = blockedWorld(["checks-pass"]);
    const s = tempStore();
    const c = config();
    const deps = fakeTickDeps(w);
    let reads = 0;
    const read = deps.readBlocked;
    deps.readBlocked = () => {
      // First read by the step; the second, right before the write, sees a newer record.
      if (++reads === 2) w.blocked!.records[ID] = record(["pr-approved"], { setAt: "2026-01-12T16:30:00.000Z" });
      return read();
    };
    const unblock = makeUnblock(deps, s, c);
    await tick(deps, s, c, { dryRun: false }, { act: async (ctx, _r, _i, opts) => unblock(ctx, opts) });
    assert.deepEqual(statusWrites(w), []);
    assert.equal(w.blocked!.records[ID]?.conditions[0], "pr-approved");
    assert.equal(s.findDispatch("Acme/widgets#1", `blocked@${SET_AT}`, "unblock")?.detail, "/w/feat was re-blocked with new conditions");
  });

  it("records a failed status write and retries it on a later tick", async () => {
    const w = blockedWorld(["checks-pass"], { orcaFails: { status: "runtime_unavailable" } });
    const s = tempStore();
    assert.match((await runTick(w, s)).stdout, /action-failed Acme\/widgets#1 unblock #1: orca-ide worktree set: runtime_unavailable/);
    assert.deepEqual(Object.keys(w.blocked?.records ?? {}), [ID]);
    delete w.orcaFails.status;
    assert.match((await runTick(w, s)).stdout, /unblocked Acme\/widgets#1/);
  });

  it("does nothing without a Blocked status id or with worktrees off, and reports an unreadable record file", async () => {
    const off = blockedWorld(["checks-pass"]);
    await runTick(off, tempStore(), { config: config({ taskStatuses: { ...DEFAULT_STATUSES } }) });
    await runTick(off, tempStore(), { config: config({ worktrees: false }) });
    assert.deepEqual(statusWrites(off), []);
    const broken = blockedWorld(["checks-pass"], { blocked: null });
    assert.match((await runTick(broken, tempStore())).stdout, /needs-decision blocked records unblock: cannot read the blocked records/);
    assert.deepEqual(statusWrites(broken), []);
  });

  it("allows only the exact unblock status write in the Orca allowlist", () => {
    assertOrca(taskStatusSetArgs(ID, "status-7", "unblocked: checks passed at c0ffee11"));
    assert.throws(() => assertOrca(taskStatusSetArgs("repo1::/w/prflow-review-widgets-1", "status-7", "x")), /not the allowed unblock status call/);
    assert.throws(() => assertOrca(taskStatusSetArgs(ID, "status-7", "")), /not the allowed unblock status call/);
    assert.throws(() => assertOrca(taskStatusSetArgs(ID, "status-7", "a\nb")), /not the allowed unblock status call/);
    assert.throws(() => assertOrca(taskStatusSetArgs(ID, "Bad!", "x")), /not the allowed unblock status call/);
    assert.throws(() => assertOrca(taskStatusSetArgs(ID, "status-7", "x").filter((a) => a !== "--unread")), /not the allowed/);
  });
});
