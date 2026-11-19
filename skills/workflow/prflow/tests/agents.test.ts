import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { makeAct, makeVerify } from "../scripts/actions.ts";
import { chooseTarget, loadTemplates, makeAgentFlow } from "../scripts/agents.ts";
import { pause } from "../scripts/commands.ts";
import { SKILL_DIR } from "../scripts/config.ts";
import type { Config } from "../scripts/core/config.ts";
import type { PiSession } from "../scripts/adapters/orca.ts";
import type { Store } from "../scripts/store.ts";
import { tick, type TickDeps } from "../scripts/tick.ts";
import { AFTER, alice, comment, HEAD, LATER, ok, prResponse, run, thread } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, T0, tempStore, world, type World } from "./state-helpers.ts";

const TEMPLATES = loadTemplates(join(SKILL_DIR, "templates", "briefs"));
const WT = "repo1::/w/x1";
const KEY = "Acme/x#1";
const JOB = "https://github.com/Acme/x/actions/runs/42/job/777";

const wtRow = (over: Record<string, unknown> = {}) => ({ id: WT, path: "/w/x1", branch: "refs/heads/feature", projectId: "github:Acme/x", linkedPR: 1, ...over });
const CI_PR = prResponse({ decision: null, checks: [ok("lint"), run("test", "COMPLETED", "FAILURE", JOB)] });
const COMMENTS_PR = prResponse({ decision: null, comments: [comment(alice, AFTER)], threads: [thread(false, comment(alice, LATER))] });
const BEHIND_PR = prResponse({ merge: "BEHIND", decision: null });
const NEW_HEAD = "beefbeef00112233445566778899aabbccddeeff";

const term = (handle: string, tab: string, lastOutputAt: number | null = null) => ({ handle, worktreeId: WT, tabId: tab, leafId: "l", agentIdentity: "pi", lastOutputAt });
const agent = (id: string, tab: string, state: string, updatedAt: number, last: string | null = null) => ({
  orcaSessionId: id, kind: "terminal", agent: "pi", state, worktreeId: WT, paneKey: `${tab}:l`, lastAssistantMessage: last, updatedAt,
});

const events = (s: Store) => s.readEventsFrom(0).events.map((e) => `${e.type}${e.dispatchId !== null ? ` #${e.dispatchId}` : ""}${e.sessionHandle ? ` ${e.sessionHandle}` : ""}: ${e.detail ?? ""}`);

function setup(pr: unknown, over: Partial<World> = {}): { w: World; s: Store } {
  return { w: world({ prs: { [KEY]: pr }, worktrees: [wtRow()], logs: { "777": "test\tRun\t2026-01-12T17:00:00.0Z FAIL src/a.test.ts\ntest\tRun\t2026-01-12T17:00:01.0Z Error: expected 2, got 3\n" }, ...over }), s: tempStore() };
}

async function runTick(w: World, s: Store, o: { live?: boolean; omitDispatchFlag?: boolean; rails?: Parameters<typeof cfg>[0]; deps?: TickDeps; config?: Config; actionsLive?: boolean } = {}) {
  const deps = o.deps ?? fakeTickDeps(w);
  const c = o.config ?? cfg(o.rails);
  const flow = makeAgentFlow(deps, s, c, TEMPLATES);
  const safe = makeAct(deps, s);
  const opts = o.omitDispatchFlag ? { dryRun: !o.actionsLive } : { dryRun: !o.actionsLive, dispatchDryRun: !o.live };
  return tick(deps, s, c, opts, {
    monitor: flow.monitor,
    verify: makeVerify(false),
    act: async (...a) => {
      await safe(...a);
      await flow.act(...a);
    },
  });
}

describe("agent dispatch: dry run", () => {
  it("is the default and announces the exact brief and target once, sending nothing", async () => {
    const { w, s } = setup(CI_PR);
    const out = (await runTick(w, s, { omitDispatchFlag: true })).stdout;
    assert.match(out, /dry-run Acme\/x#1 ci: would launch a fresh Pi session in \/w\/x1; brief ci v1:\n# Fix failing CI on Acme\/x#1/);
    assert.match(out, /- \*\*test\*\*: https:\/\/github\.com\/Acme\/x\/actions\/runs\/42\/job\/777/);
    assert.match(out, /Error: expected 2, got 3/);
    assert.match(out, /Never merge, enable auto-merge, approve, dismiss reviews, or force-push\./);
    assert.match(out, /Do not change your own workflow, skills, prompts, or agent configuration/);
    assert.deepEqual(w.effects, []);
    assert.deepEqual(s.openDispatches(), []);
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { omitDispatchFlag: true })).stdout, "");
  });

  it("names the idle session it would message, and waits silently while one is busy", async () => {
    const { w, s } = setup(BEHIND_PR, { terminals: { [WT]: [term("term_a", "t1", T0 - 60 * MIN)] }, agents: [agent("s1", "t1", "working", T0 - MIN)] });
    assert.equal((await runTick(w, s)).stdout.includes("dry-run"), false);
    w.agents = [agent("s1", "t1", "done", T0 - MIN, "all done")];
    w.clock += 15 * MIN;
    const out = (await runTick(w, s)).stdout;
    assert.match(out, /dry-run Acme\/x#1 behind: would message idle Pi session term_a in \/w\/x1 with orchestration send; brief behind v1/);
    assert.match(out, /merge `origin\/main` into `feature`\. Do not rebase/);
    assert.deepEqual(w.effects, []);
  });

  it("is separate from actions.dryRun", async () => {
    const { w, s } = setup(CI_PR);
    const out = (await runTick(w, s, { actionsLive: true })).stdout;
    assert.match(out, /dry-run Acme\/x#1 ci/);
    assert.deepEqual(w.effects, []);
  });

  it("points widget project PRs at the project context", async () => {
    const { w, s } = setup(COMMENTS_PR);
    const c = cfg();
    c.dispatch.projectContext = [{ path: "/docs/sync", folder: "proj", repos: ["acme/x"] }];
    const out = (await runTick(w, s, { config: c })).stdout;
    assert.match(out, /Project context: this PR belongs to the shared project documented in `\/docs\/sync` \(`proj\/`\)\. Run `git pull` there, then read `\/docs\/sync\/AGENTS\.md` and `\/docs\/sync\/proj\/AGENTS\.md`/);
  });

  it("lists each comment with author, file:line, URL, and text", async () => {
    const { w, s } = setup(COMMENTS_PR);
    const out = (await runTick(w, s)).stdout;
    assert.match(out, /- \*\*alice\*\* commented \(2026-01-10 13:00Z\) https:\/\/github\.com\/Acme\/x\/pull\/1#c1\n {2}> comment 1/);
    assert.match(out, /- Unresolved thread on `src\/a\.ts:7`, last comment https:\/\/github\.com\/Acme\/x\/pull\/1#c2\n {2}- \*\*alice\*\* \(2026-01-10 14:00Z\)/);
    assert.match(out, /Reply to each item you addressed/);
  });
});

describe("agent dispatch: worktree", () => {
  it("asks once when the PR has no Orca worktree, and never creates one", async () => {
    const { w, s } = setup(CI_PR, { worktrees: [wtRow({ linkedPR: 9, branch: "refs/heads/feature" })] });
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /needs-decision Acme\/x#1 ci: ci needs a Pi session, but no Orca worktree is linked to #1 or on branch feature\. prflow does not create worktrees/);
    assert.deepEqual(w.effects, []);
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { live: true })).stdout, "");
  });

  it("falls back to the head branch when no worktree is linked", async () => {
    const { w, s } = setup(CI_PR, { worktrees: [wtRow({ linkedPR: null })] });
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, [`launch ${WT}`]);
  });
});

describe("agent dispatch: live", () => {
  it("writes the row and event before launching, then records the session", async () => {
    const { w, s } = setup(CI_PR);
    const base = fakeTickDeps(w);
    const seen: string[] = [];
    const deps: TickDeps = {
      ...base,
      async launchPi(wt, prompt) {
        seen.push(`${s.openDispatches()[0]?.state} ${events(s).at(-1)}`);
        return base.launchPi(wt, prompt);
      },
    };
    const out = (await runTick(w, s, { live: true, deps })).stdout;
    assert.deepEqual(seen, ["launched dispatched #1: brief ci v1: launch a fresh Pi session in /w/x1"]);
    assert.deepEqual(w.effects, [`launch ${WT}`]);
    const d = s.dispatch(1);
    assert.equal(d?.state, "launched");
    assert.equal(d?.sessionHandle, "term_new1");
    assert.match(w.sent[0] ?? "", /^launch repo1::\/w\/x1 \| # Fix failing CI on Acme\/x#1/);
    assert.match(out, /## In flight \(1\)\n- Acme\/x#1 ci #1 \| session term_new1 \| launched \| age 0m \| lease until 17:45Z \| attempt 1/);
  });

  it("messages an idle Pi session with orchestration send", async () => {
    const { w, s } = setup(CI_PR, { terminals: { [WT]: [term("term_a", "t1", T0 - 60 * MIN)] }, agents: [agent("s1", "t1", "done", T0 - 60 * MIN)] });
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, ["send term_a"]);
    assert.match(w.sent[0] ?? "", /^term_a \| prflow: ci on Acme\/x#1 \| # Fix failing CI/);
    assert.equal(s.dispatch(1)?.sessionHandle, "term_a");
  });

  it("never prompts a busy session: the dispatch stays planned until it is idle", async () => {
    const { w, s } = setup(CI_PR, { terminals: { [WT]: [term("term_a", "t1", T0)] }, agents: [agent("s1", "t1", "working", T0)] });
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /dispatched Acme\/x#1 ci #1: brief ci v1: planned; wait: Pi session term_a is working/);
    assert.deepEqual(w.effects, []);
    assert.equal(s.dispatch(1)?.state, "planned");

    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, []);

    w.agents = [agent("s1", "t1", "done", w.clock)];
    w.clock += 15 * MIN;
    const sent = (await runTick(w, s, { live: true })).stdout;
    assert.match(sent, /dispatched Acme\/x#1 ci #1: message idle Pi session term_a in \/w\/x1 with orchestration send \(was waiting\)/);
    assert.deepEqual(w.effects, ["send term_a"]);
    assert.equal(s.dispatch(1)?.attempts, 1);
  });

  it("does not deliver a deferred dispatch once its item is paused", async () => {
    const { w, s } = setup(CI_PR, { terminals: { [WT]: [term("term_a", "t1", T0)] }, agents: [agent("s1", "t1", "working", T0)] });
    await runTick(w, s, { live: true });
    pause(s, w.clock, { item: KEY }, "hold");
    w.agents = [agent("s1", "t1", "done", w.clock)];
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, []);
    assert.equal(s.dispatch(1)?.state, "planned");
  });

  it("a deferred retry still replaces the earlier session instead of messaging it", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true });
    // The lease runs out while another Pi session in the worktree is busy.
    w.clock += 46 * MIN;
    w.terminals[WT] = [term("term_new1", "tab1", T0), term("term_b", "tb", w.clock)];
    w.agents = [agent("s9", "tab1", "done", T0), agent("sb", "tb", "working", w.clock)];
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /dispatched Acme\/x#1 ci #1: brief ci v1: planned; wait: Pi session term_b is working/);
    assert.equal(s.dispatch(1)?.state, "planned");
    assert.equal(s.dispatch(1)?.attempts, 2);
    w.agents = [agent("s9", "tab1", "done", T0), agent("sb", "tb", "done", w.clock)];
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, [`launch ${WT}`, "close term_new1", `launch ${WT}`]);
  });

  it("treats waiting, blocked, and unknown sessions as busy", () => {
    const s = (state: PiSession["state"]): PiSession => ({ handle: "term_a", kind: "terminal", sessionId: null, state, lastActivityAt: 1, lastMessage: null });
    for (const st of ["working", "blocked", "waiting", "unknown"] as const) assert.equal(chooseTarget([s(st)], null).do, "wait", st);
    assert.equal(chooseTarget([s("done")], null).do, "message");
    assert.deepEqual(chooseTarget([], null), { do: "launch", close: null });
    // A retry replaces the earlier session even when it is idle.
    assert.deepEqual(chooseTarget([s("done")], "term_a"), { do: "launch", close: s("done") });
  });

  it("renews the lease while the session shows progress, then finishes with its last message", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true });
    const lease0 = s.dispatch(1)?.leaseUntil ?? 0;

    w.clock += 30 * MIN;
    w.terminals[WT] = [term("term_new1", "tab1", w.clock - MIN)];
    w.agents = [agent("s9", "tab1", "working", w.clock - MIN)];
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "working");
    assert.ok((s.dispatch(1)?.leaseUntil ?? 0) > lease0);

    // Lease would have expired at 45m without the renewal.
    w.clock += 30 * MIN;
    w.prs[KEY] = prResponse({ head: NEW_HEAD, decision: null, merge: "BLOCKED", checks: [run("test", "IN_PROGRESS", null)] });
    w.agents = [agent("s9", "tab1", "done", w.clock - MIN, `Pushed ${"x".repeat(600)}`)];
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.equal(s.dispatch(1)?.state, "done");
    assert.match(out, /session-finished Acme\/x#1 ci #1: new head beefbeef; last message: Pushed x+\.\.\./);
    const ev = s.readEventsFrom(0).events.find((e) => e.type === "session-finished");
    assert.equal(ev?.sessionHandle, "term_new1");
    assert.ok((ev?.detail ?? "").length < 600);
  });

  it("recovery ladder: nudge once, then stale, then a fresh session with what was done, then abandoned", async () => {
    const { w, s } = setup(CI_PR, { terminals: { [WT]: [term("term_a", "t1", T0 - 60 * MIN)] }, agents: [agent("s1", "t1", "done", T0 - 60 * MIN)] });
    await runTick(w, s, { live: true, rails: { maxAttempts: 2 } });
    assert.deepEqual(w.effects, ["send term_a"]);

    // Idle after picking up the brief, PR unchanged: one nudge.
    w.clock += 10 * MIN;
    w.agents = [agent("s1", "t1", "done", w.clock - MIN, "I looked but stopped")];
    const n = (await runTick(w, s, { live: true, rails: { maxAttempts: 2 } })).stdout;
    assert.match(n, /nudged Acme\/x#1 ci #1: idle with ci unfinished; last message: I looked but stopped/);
    assert.deepEqual(w.effects, ["send term_a", "send term_a"]);
    assert.match(w.sent[1] ?? "", /still needs the ci work/);

    // Idle again after the nudge: stale.
    w.clock += 10 * MIN;
    w.agents = [agent("s1", "t1", "done", w.clock - MIN, "Still stuck on the flaky test")];
    const st = (await runTick(w, s, { live: true, rails: { maxAttempts: 2 } })).stdout;
    assert.match(st, /session-stale Acme\/x#1 ci #1: idle again after a nudge with the work unfinished; last message: Still stuck/);
    // The same tick retries: close the old session, launch fresh with the progress.
    assert.deepEqual(w.effects.slice(2), ["close term_a", `launch ${WT}`]);
    assert.equal(s.dispatch(1)?.attempts, 2);
    assert.match(w.sent.at(-1) ?? "", /## Previous attempt\n\nThis is attempt 2\. Attempt 1 ended: idle again after a nudge with the work unfinished\. Its last message:\n\n {2}> Still stuck on the flaky test/);

    // The fresh session closes with nothing done: stale, then abandoned at maxAttempts.
    w.clock += 10 * MIN;
    w.terminals[WT] = [];
    const ab = (await runTick(w, s, { live: true, rails: { maxAttempts: 2 } })).stdout;
    assert.match(ab, /session-stale Acme\/x#1 ci #1: session term_new1 closed with the work unfinished/);
    assert.match(ab, /abandoned Acme\/x#1 ci #1: 2 attempts ended stale/);
    assert.match(ab, /paused Acme\/x#1 ci #1: dispatch #1 abandoned/);
    assert.equal(s.dispatch(1)?.state, "abandoned");
    assert.equal(s.item(KEY)?.paused, true);
    assert.equal(w.effects.length, 4);
  });

  it("marks a session stuck working past stuckMinutes stale", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true, rails: { stuckMinutes: 60 } });
    for (let i = 1; i <= 4; i++) {
      w.clock += 20 * MIN;
      w.terminals[WT] = [term("term_new1", "tab1", w.clock - MIN)];
      w.agents = [agent("s9", "tab1", "working", w.clock - MIN)];
      await runTick(w, s, { live: true, rails: { stuckMinutes: 60, maxAttempts: 1 } });
    }
    assert.match(events(s).join("\n"), /session-stale #1 term_new1: stuck working for 80m \(limit 60m\)/);
  });

  it("marks a dispatch stale when its lease runs out with no activity", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true });
    w.clock += 46 * MIN;
    await runTick(w, s, { live: true, rails: { maxAttempts: 1 } });
    assert.match(events(s).join("\n"), /session-stale #1 term_new1: lease expired with no progress/);
  });

  it("adopts the session of an orphaned launched row", async () => {
    const { w, s } = setup(CI_PR);
    const d = s.createDispatch(KEY, "x", "ci", T0 - MIN);
    s.transition(d.id, "launched", T0 - MIN, { leaseUntil: T0 + 44 * MIN });
    s.patchDispatch(d.id, { worktree: WT, sentAt: T0 - MIN }, T0 - MIN);
    w.terminals[WT] = [term("term_z", "tz", T0)];
    w.agents = [agent("sz", "tz", "working", T0)];
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /recovered Acme\/x#1 ci #1: adopted orphaned session term_z/);
    assert.equal(s.dispatch(d.id)?.sessionHandle, "term_z");
    assert.equal(s.dispatch(d.id)?.state, "working");
  });

  it("records a failed launch and retries it next tick", async () => {
    const { w, s } = setup(CI_PR, { orcaFails: { launch: "no such worktree" } });
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /action-failed Acme\/x#1 ci #1: orca-ide agent launch: no such worktree/);
    assert.equal(s.dispatch(1)?.state, "failed");
    w.orcaFails = {};
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "launched");
    assert.equal(s.dispatch(1)?.attempts, 2);
  });

  it("does not launch a second session when closing the old one fails", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true });
    w.clock += 46 * MIN;
    w.orcaFails = { close: "pty busy" };
    w.terminals[WT] = [term("term_new1", "tab1", T0)];
    w.agents = [agent("s9", "tab1", "done", T0)];
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /action-failed Acme\/x#1 ci #1: orca-ide terminal close term_new1: pty busy; not launching a second session/);
    assert.deepEqual(w.effects, [`launch ${WT}`, "close term_new1"]);
  });

  it("starts nothing for a paused item, and one dispatch per item at a time", async () => {
    const { w, s } = setup(CI_PR);
    pause(s, T0, { item: KEY }, "hold");
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, []);

    const t = setup(CI_PR);
    await runTick(t.w, t.s, { live: true });
    // New feedback on the same head is a new version, but the first dispatch is still open.
    t.w.prs[KEY] = prResponse({ decision: null, checks: [ok("lint"), run("test", "COMPLETED", "FAILURE", JOB)], comments: [comment(alice, AFTER)] });
    t.w.clock += 5 * MIN;
    await runTick(t.w, t.s, { live: true });
    assert.deepEqual(t.w.effects, [`launch ${WT}`]);
  });

  it("applies the per-tick cap", async () => {
    const s = tempStore();
    const w = world({
      prs: { [KEY]: CI_PR, "Acme/x#2": CI_PR },
      worktrees: [wtRow(), wtRow({ id: "repo1::/w/x2", path: "/w/x2", linkedPR: 2, branch: "refs/heads/other" })],
    });
    const out = (await runTick(w, s, { live: true, rails: { startsPerTick: 1 } })).stdout;
    assert.equal(w.effects.length, 1);
    assert.match(out, /rail-tripped prflow: cap startsPerTick=1 reached/);
  });

  it("fails the tick when Orca cannot list agents", async () => {
    const { w, s } = setup(CI_PR, { orcaFails: { agents: "orca not running" } });
    const r = await runTick(w, s, { live: true });
    assert.equal(r.exitCode, 1);
    assert.match(r.stderr, /orca-ide agent list: orca not running/);
    assert.deepEqual(w.effects, []);
  });

  it("finishes when the PR leaves the scan while the session is gone", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true });
    w.prs = {};
    w.terminals[WT] = [];
    w.clock += 10 * MIN;
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /session-finished Acme\/x#1 ci #1: the PR is no longer an open, non-draft PR of yours; session term_new1 is gone/);
  });

  it("uses the head sha in the brief", async () => {
    const { w, s } = setup(CI_PR);
    await runTick(w, s, { live: true });
    assert.match(w.sent[0] ?? "", new RegExp(`head \`${HEAD.slice(0, 12)}\``));
  });
});
