import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeAct, makeVerify } from "../scripts/actions.ts";
import { parsePr } from "../scripts/adapters/gh.ts";
import { pause, resume } from "../scripts/commands.ts";
import type { Store } from "../scripts/store.ts";
import { tick, type TickDeps } from "../scripts/tick.ts";
import { HEAD, ME, ok, prResponse, run, status } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, okJson, T0, tempStore, world, type World } from "./state-helpers.ts";

const WT_REF = "pr view 5 -R acme/x --json number,state,title,url,headRefOid";
const prRef = (number: number, state: string) => okJson({ number, state, title: `t${number}`, url: `https://github.com/Acme/x/pull/${number}`, headRefOid: "abc" });
const wtRow = (path: string, pr = 5) => ({ path, branch: `refs/heads/b${pr}`, projectId: "github:acme/x", linkedPR: pr });

const events = (s: Store) => s.readEventsFrom(0).events.map((e) => `${e.type} ${e.item ?? "-"}${e.dispatchId !== null ? ` #${e.dispatchId}` : ""}${e.detail ? `: ${e.detail}` : ""}`);

async function runTick(w: World, s: Store, opts: { dryRun?: boolean; worktrees?: boolean; rails?: Parameters<typeof cfg>[0]; deps?: TickDeps } = {}) {
  const deps = opts.deps ?? fakeTickDeps(w);
  const c = cfg(opts.rails, opts.worktrees ?? false);
  return tick(deps, s, c, { dryRun: opts.dryRun ?? false }, { act: makeAct(deps, s), verify: makeVerify(c.worktrees) });
}

describe("cleanup action", () => {
  const merged = (over: Partial<World> = {}) => world({ worktrees: [wtRow("/w/a")], refs: { [WT_REF]: prRef(5, "MERGED") }, ...over });

  it("archives a clean worktree with no unpushed commits after writing its dispatch and event", async () => {
    const s = tempStore();
    const w = merged();
    const base = fakeTickDeps(w);
    const seen: string[] = [];
    const deps: TickDeps = {
      ...base,
      async archiveWorktree(path) {
        seen.push(`${s.openDispatches()[0]?.state} ${events(s).at(-1)}`);
        return base.archiveWorktree(path);
      },
    };
    const out = (await runTick(w, s, { worktrees: true, deps })).stdout;
    assert.deepEqual(seen, ["launched dispatched Acme/x#5 #1: orca-ide worktree rm --worktree path:/w/a --json; git --git-dir /repo/.git update-ref -d refs/heads/b5 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]);
    assert.deepEqual(w.effects, ["archive /w/a", "delete-branch b5"]);
    assert.equal(s.dispatch(1)?.state, "done");
    assert.match(out, /archived Acme\/x#5 cleanup #1: archived \/w\/a \(PR MERGED; deleted local branch b5\)/);
  });

  it("keeps the branch of a closed, unmerged PR", async () => {
    const s = tempStore();
    const w = merged({ refs: { [WT_REF]: prRef(5, "CLOSED") } });
    const out = (await runTick(w, s, { worktrees: true })).stdout;
    assert.deepEqual(w.effects, ["archive /w/a"]);
    assert.match(out, /archived Acme\/x#5 cleanup #1: archived \/w\/a \(PR CLOSED; branch kept\)/);
  });

  for (const [name, head, why] of [
    ["detached", null, "HEAD is detached"],
    ["switched", "other", "worktree is on other"],
  ] as const)
    it(`keeps the branch when the worktree is ${name}`, async () => {
      const s = tempStore();
      const w = merged({ heads: { "/w/a": head } });
      const out = (await runTick(w, s, { worktrees: true })).stdout;
      assert.deepEqual(w.effects, ["archive /w/a"]);
      assert.match(out, new RegExp(`archived /w/a \\(PR MERGED; local branch b5 kept: ${why}\\)`));
    });

  it("still records the archive when branch deletion fails", async () => {
    const s = tempStore();
    const w = merged({ branchFails: { b5: "cannot lock ref" } });
    const out = (await runTick(w, s, { worktrees: true })).stdout;
    assert.equal(s.dispatch(1)?.state, "done");
    assert.match(out, /archived \/w\/a \(PR MERGED; local branch b5 kept: cannot lock ref\)/);
  });

  for (const [name, over, why] of [
    ["dirty", { dirty: { "/w/a": 2 } }, "2 uncommitted file\\(s\\)"],
    ["unpushed", { unpushed: { "/w/a": 3 } }, "3 unpushed commit\\(s\\)"],
    ["unknown state", { dirty: { "/w/a": null }, unpushed: { "/w/a": null } }, "uncommitted state unknown and unpushed commits unknown"],
  ] as const)
    it(`asks once instead of archiving a ${name} worktree`, async () => {
      const s = tempStore();
      const w = merged(over as Partial<World>);
      const out = (await runTick(w, s, { worktrees: true })).stdout;
      assert.match(out, new RegExp(`needs-decision Acme/x#5 cleanup: PR MERGED; worktree /w/a has ${why}\\. prflow will not archive it`));
      assert.deepEqual(w.effects, []);
      w.clock += 15 * MIN;
      assert.equal((await runTick(w, s, { worktrees: true })).stdout, "");
    });

  it("dry run announces the archive command and archives nothing", async () => {
    const s = tempStore();
    const w = merged();
    assert.match((await runTick(w, s, { worktrees: true, dryRun: true })).stdout, /dry-run Acme\/x#5 cleanup: would run: orca-ide worktree rm --worktree path:\/w\/a --json/);
    assert.deepEqual(w.effects, []);
    assert.equal(s.openDispatches().length, 0);
  });

  it("records a failed archive", async () => {
    const s = tempStore();
    const w = merged({ archiveFails: { "/w/a": "worktree_archive_hook_failed" } });
    assert.match((await runTick(w, s, { worktrees: true })).stdout, /action-failed Acme\/x#5 cleanup #1: orca-ide worktree rm: worktree_archive_hook_failed/);
    assert.equal(s.dispatch(1)?.state, "failed");
  });

  it("respects the per-tick start cap across actions", async () => {
    const s = tempStore();
    const w = world({
      worktrees: [wtRow("/w/a", 5), wtRow("/w/b", 6)],
      refs: { [WT_REF]: prRef(5, "CLOSED"), [WT_REF.replace("view 5", "view 6")]: prRef(6, "MERGED") },
    });
    const out = (await runTick(w, s, { worktrees: true, rails: { startsPerTick: 1 } })).stdout;
    assert.deepEqual(w.effects, ["archive /w/a"]);
    assert.match(out, /rail-tripped prflow: cap startsPerTick=1 reached/);
    w.clock += 15 * MIN;
    await runTick(w, s, { worktrees: true, rails: { startsPerTick: 1 } });
    assert.deepEqual(w.effects, ["archive /w/a", "archive /w/b", "delete-branch b6"]);
  });
});

describe("reconcile after a crash", () => {
  it("settles an interrupted cleanup when the worktree is gone", async () => {
    const s = tempStore();
    s.createDispatch("Acme/x#5", "MERGED:/w/a", "cleanup", T0);
    await runTick(world(), s, { worktrees: true });
    assert.equal(s.dispatch(1)?.state, "done");
  });

  it("leaves an unconfirmed action open until its lease runs out, then marks it stale", async () => {
    const s = tempStore();
    const w = world();
    s.createDispatch("Acme/x#1", "deadbeef-00000000", "cleanup", T0);
    await runTick(w, s);
    assert.equal(s.dispatch(1)?.state, "planned");
    w.clock = T0 + 46 * MIN;
    await runTick(w, s);
    assert.equal(s.dispatch(1)?.state, "stale");
  });
});
