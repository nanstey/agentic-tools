import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeAct, makeVerify, rerunTargets } from "../scripts/actions.ts";
import { parsePr } from "../scripts/adapters/gh.ts";
import { pause } from "../scripts/commands.ts";
import type { Store } from "../scripts/store.ts";
import { tick, type TickDeps } from "../scripts/tick.ts";
import { HEAD, ME, ok, prResponse, run, status } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, okJson, T0, tempStore, world, type World } from "./state-helpers.ts";

const RUN_URL = (id: number, job = 1) => `https://github.com/Acme/x/actions/runs/${id}/job/${job}`;
const cancelled = (name: string, runId: number) => run(name, "COMPLETED", "CANCELLED", RUN_URL(runId));
const RERUN_PR = prResponse({ decision: null, checks: [ok("lint"), cancelled("e2e", 42)] });

const events = (s: Store) => s.readEventsFrom(0).events.map((e) => `${e.type} ${e.item ?? "-"}${e.dispatchId !== null ? ` #${e.dispatchId}` : ""}${e.detail ? `: ${e.detail}` : ""}`);

async function runTick(w: World, s: Store, opts: { dryRun?: boolean; worktrees?: boolean; rails?: Parameters<typeof cfg>[0]; deps?: TickDeps } = {}) {
  const deps = opts.deps ?? fakeTickDeps(w);
  const c = cfg(opts.rails, opts.worktrees ?? false);
  return tick(deps, s, c, { dryRun: opts.dryRun ?? false }, { act: makeAct(deps, s), verify: makeVerify(c.worktrees) });
}

describe("rerunTargets", () => {
  it("collects run ids of cancelled or failed Actions jobs in the PR's repo", () => {
    const pr = parsePr(
      JSON.stringify(
        prResponse({
          checks: [
            cancelled("a", 42),
            run("b", "COMPLETED", "CANCELLED", RUN_URL(42, 2)),
            run("c", "COMPLETED", "FAILURE", RUN_URL(7)),
            ok("d"),
            run("e", "COMPLETED", "CANCELLED", "https://ci.example/build/1"),
            run("f", "COMPLETED", "CANCELLED", "https://github.com/Other/repo/actions/runs/9/job/1"),
            status("g", "ERROR"),
          ],
        }),
      ),
      "Acme/x",
      1,
      "author",
      ME,
    );
    assert.ok(pr);
    assert.deepEqual(rerunTargets(pr), { runIds: ["42", "7"], unknown: ["e", "f"] });
  });
});

describe("rerun action", () => {
  it("dry run announces the exact command once and changes nothing", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": RERUN_PR } });
    const out = (await runTick(w, s, { dryRun: true })).stdout;
    assert.match(out, /dry-run Acme\/x#1 rerun: would run: gh run rerun 42 --failed -R Acme\/x/);
    assert.deepEqual(w.effects, []);
    assert.equal(s.findDispatch("Acme/x#1", s.items()[0]?.version ?? "", "rerun"), null);
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { dryRun: true })).stdout, "");
  });

  it("writes the dispatch row and event before rerunning, then records done", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": RERUN_PR } });
    const base = fakeTickDeps(w);
    const seen: string[] = [];
    const deps: TickDeps = {
      ...base,
      async rerunFailed(login, repo, id) {
        const d = s.openDispatches()[0];
        seen.push(`${d?.state} ${events(s).at(-1)}`);
        return base.rerunFailed(login, repo, id);
      },
    };
    const out = (await runTick(w, s, { deps })).stdout;
    assert.deepEqual(seen, ["launched dispatched Acme/x#1 #1: gh run rerun 42 --failed -R Acme/x"]);
    assert.deepEqual(w.effects, ["rerun Acme/x 42"]);
    assert.equal(s.dispatch(1)?.state, "done");
    assert.match(out, /rerun Acme\/x#1 rerun #1: reran failed and cancelled jobs in run 42/);
    // Same version next tick: idempotent, no second rerun.
    w.clock += 15 * MIN;
    await runTick(w, s);
    assert.deepEqual(w.effects, ["rerun Acme/x 42"]);
  });

  it("never reruns while a run is still in progress or its status is unknown", async () => {
    for (const st of ["in_progress", "queued", null]) {
      const s = tempStore();
      const w = world({ prs: { "Acme/x#1": RERUN_PR }, runs: { "42": st } });
      await runTick(w, s);
      assert.deepEqual(w.effects, [], String(st));
      assert.equal(s.openDispatches().length + s.ledger().length, 0);
    }
  });

  it("never reruns while any PR check is pending", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": prResponse({ decision: null, checks: [cancelled("e2e", 42), run("t", "IN_PROGRESS", null)] }) } });
    await runTick(w, s);
    assert.deepEqual(w.effects, []);
  });

  it("records a failed rerun, retries next tick, then abandons and pauses the item", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": RERUN_PR }, rerunFails: { "42": "HTTP 403" } });
    const out = (await runTick(w, s, { rails: { maxAttempts: 2 } })).stdout;
    assert.match(out, /action-failed Acme\/x#1 rerun #1: run 42: HTTP 403/);
    assert.equal(s.dispatch(1)?.state, "failed");
    w.clock += 15 * MIN;
    await runTick(w, s, { rails: { maxAttempts: 2 } });
    assert.equal(s.dispatch(1)?.attempts, 2);
    w.clock += 15 * MIN;
    const third = (await runTick(w, s, { rails: { maxAttempts: 2 } })).stdout;
    assert.equal(w.effects.length, 2);
    assert.equal(s.dispatch(1)?.state, "abandoned");
    assert.match(third, /abandoned Acme\/x#1 rerun #1/);
    assert.match(third, /## Needs your decision \(1\)\n- Acme\/x#1 paused: dispatch #1 abandoned/);
  });

  it("asks once when cancelled checks have no Actions run to rerun", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": prResponse({ decision: null, checks: [run("ext", "COMPLETED", "CANCELLED", "https://ci.example/1")] }) } });
    assert.match((await runTick(w, s)).stdout, /needs-decision Acme\/x#1 rerun: cancelled checks have no GitHub Actions run prflow can rerun \(ext\)/);
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s)).stdout, "");
    assert.deepEqual(w.effects, []);
  });

  it("does nothing for paused items or a paused prflow", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": RERUN_PR } });
    pause(s, T0, { item: "Acme/x#1" }, "hands off");
    await runTick(w, s);
    pause(s, T0, {}, "all off");
    await runTick(w, s, { dryRun: true });
    assert.deepEqual(w.effects, []);
    assert.ok(!events(s).some((e) => e.startsWith("dry-run") || e.startsWith("dispatched")));
  });

  it("skips a rerun the legacy automation already made at this head", async () => {
    const s = tempStore();
    s.addLedger({ at: T0, item: "Acme/x#1", version: HEAD.slice(0, 8), kind: "rerun", outcome: "legacy-dispatched", source: "legacy:pr-comment-watch", ref: "x" });
    const w = world({ prs: { "Acme/x#1": RERUN_PR } });
    await runTick(w, s);
    assert.deepEqual(w.effects, []);
  });
});

const WT_REF = "pr view 5 -R acme/x --json number,state,title,url,headRefOid";
const wtRow = (path: string, pr = 5) => ({ path, branch: `refs/heads/b${pr}`, projectId: "github:acme/x", linkedPR: pr });
const prRef = (number: number, state: string) => okJson({ number, state, title: `t${number}`, url: `https://github.com/Acme/x/pull/${number}`, headRefOid: "abc" });

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
    assert.deepEqual(seen, ["launched dispatched Acme/x#5 #1: orca-ide worktree rm --worktree path:/w/a --json"]);
    assert.deepEqual(w.effects, ["archive /w/a"]);
    assert.equal(s.dispatch(1)?.state, "done");
    assert.match(out, /archived Acme\/x#5 cleanup #1: archived \/w\/a \(PR MERGED; branch kept\)/);
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
    assert.deepEqual(w.effects, ["archive /w/a", "archive /w/b"]);
  });
});

describe("dry run cap", () => {
  it("announces actions beyond the per-tick cap in later ticks", async () => {
    const s = tempStore();
    const paths = ["/w/a", "/w/b", "/w/c"];
    const w = world({
      worktrees: paths.map((p, i) => wtRow(p, 5 + i)),
      refs: Object.fromEntries(paths.map((_, i) => [WT_REF.replace("view 5", `view ${5 + i}`), prRef(5 + i, "MERGED")])),
    });
    const dry = async () => (await runTick(w, s, { worktrees: true, dryRun: true, rails: { startsPerTick: 2 } })).stdout.match(/dry-run .*/g) ?? [];
    assert.equal((await dry()).length, 2);
    w.clock += 15 * MIN;
    assert.deepEqual((await dry()).map((l) => l.slice(0, 30)), ["dry-run Acme/x#7 cleanup: woul"]);
    w.clock += 15 * MIN;
    assert.deepEqual(await dry(), []);
    assert.deepEqual(w.effects, []);
  });
});

describe("reconcile after a crash", () => {
  it("settles an interrupted rerun when checks are running again on the same head", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": prResponse({ decision: null, checks: [run("e2e", "IN_PROGRESS", null)] }) } });
    s.createDispatch("Acme/x#1", `${HEAD.slice(0, 8)}-whatever`, "rerun", T0);
    const out = (await runTick(w, s)).stdout;
    assert.equal(s.dispatch(1)?.state, "done");
    assert.match(out, /recovered Acme\/x#1 rerun #1: done: checks are running again on the same head/);
  });

  it("settles an interrupted cleanup when the worktree is gone", async () => {
    const s = tempStore();
    s.createDispatch("Acme/x#5", "MERGED:/w/a", "cleanup", T0);
    await runTick(world(), s, { worktrees: true });
    assert.equal(s.dispatch(1)?.state, "done");
  });

  it("leaves an unconfirmed action open until its lease runs out, then marks it stale", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": RERUN_PR } });
    s.createDispatch("Acme/x#1", "deadbeef-00000000", "rerun", T0);
    await runTick(w, s);
    assert.equal(s.dispatch(1)?.state, "planned");
    w.clock = T0 + 46 * MIN;
    await runTick(w, s);
    assert.equal(s.dispatch(1)?.state, "stale");
  });
});
