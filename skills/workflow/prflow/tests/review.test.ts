import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { makeAct, makeVerify } from "../scripts/actions.ts";
import { loadTemplates, makeAgentFlow } from "../scripts/agents.ts";
import { importLegacy, pause, recover } from "../scripts/commands.ts";
import { SKILL_DIR } from "../scripts/config.ts";
import type { Config } from "../scripts/core/config.ts";
import { draftPaths, makeReviewFlow } from "../scripts/review.ts";
import { commentKey, recordPosted, textHash } from "../scripts/revisions.ts";
import { parseDraft } from "../scripts/core/draft.ts";
import type { Store } from "../scripts/store.ts";
import { tick, type TickDeps } from "../scripts/tick.ts";
import { AFTER, alice, DRAFT, HEAD, ME, ok, prResponse, review, run, user } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, T0, tempStore, world, type World } from "./state-helpers.ts";

const TEMPLATES = loadTemplates(join(SKILL_DIR, "templates", "briefs"));
const KEY = "Acme/x#5";
const H8 = HEAD.slice(0, 8);
const SLUG = "x-5";
const RWT = `rid1::/w/review/prflow-review-${SLUG}`;
const RPATH = `/w/review/prflow-review-${SLUG}`;
const NEW_HEAD = "beefbeef00112233445566778899aabbccddeeff";

const MAIN = { id: "rid1::/repos/x", repoId: "rid1", path: "/repos/x", branch: "refs/heads/main", projectId: "github:Acme/x", isMainWorktree: true };
const REQ = (over: Parameters<typeof prResponse>[0] = {}) => prResponse({ decision: "REVIEW_REQUIRED", requests: [ME], ...over });


const events = (s: Store) => s.readEventsFrom(0).events.map((e) => `${e.type}${e.dispatchId !== null ? ` #${e.dispatchId}` : ""}${e.sessionHandle ? ` ${e.sessionHandle}` : ""}: ${e.detail ?? ""}`);
const types = (s: Store) => s.readEventsFrom(0).events.map((e) => e.type);

function setup(over: Partial<World> = {}, prs: Record<string, unknown> = { [KEY]: REQ() }): { w: World; s: Store } {
  return { w: world({ reviewPrs: prs, worktrees: [MAIN], ...over }), s: tempStore() };
}

interface RunOpts {
  live?: boolean;
  dispatchLive?: boolean;
  actionsLive?: boolean;
  omitFlag?: boolean;
  config?: Config;
  deps?: TickDeps;
}

async function runTick(w: World, s: Store, o: RunOpts = {}) {
  const deps = o.deps ?? fakeTickDeps(w);
  const c = o.config ?? cfg();
  const agents = makeAgentFlow(deps, s, c, TEMPLATES);
  const reviews = makeReviewFlow(deps, s, c, TEMPLATES);
  const safe = makeAct(deps, s);
  const opts = o.omitFlag ? { dryRun: !o.actionsLive, dispatchDryRun: !o.dispatchLive } : { dryRun: !o.actionsLive, dispatchDryRun: !o.dispatchLive, reviewDryRun: !o.live };
  return tick(deps, s, c, opts, {
    monitor: async (...a) => {
      await agents.monitor(...a);
      await reviews.monitor(...a);
    },
    verify: makeVerify(false),
    act: async (...a) => {
      await safe(...a);
      await agents.act(...a);
      await reviews.act(...a);
    },
    annotate: reviews.annotate,
  });
}

/** Set a session's Orca state: terminal output time and its agent row. */
function session(w: World, wt: string, handle: string, state: string, at: number, last: string | null = null) {
  const t = (w.terminals[wt] ?? []).find((x) => x.handle === handle) as { tabId: string; lastOutputAt: number | null } | undefined;
  if (!t) throw new Error(`no terminal ${handle}`);
  t.lastOutputAt = at;
  const pane = `${t.tabId}:l`;
  w.agents = w.agents.filter((a) => a.paneKey !== pane);
  w.agents.push({ orcaSessionId: `s-${handle}`, kind: "terminal", agent: "pi", state, worktreeId: wt, paneKey: pane, lastAssistantMessage: last, updatedAt: at });
}

/** Orca unmounts a terminal's pane: `terminal list` shows synthetic pty: ids and keeps the old pane as `recordedPaneKey`. */
function orphan(w: World, wt: string, handle: string) {
  const t = (w.terminals[wt] ?? []).find((x) => x.handle === handle) as Record<string, unknown> | undefined;
  if (!t) throw new Error(`no terminal ${handle}`);
  const pty = `pty:${wt}@@${handle}`;
  Object.assign(t, { orphaned: true, recordedPaneKey: `${String(t.tabId)}:${String(t.leafId)}`, tabId: pty, leafId: pty });
}

function saveDraft(s: Store, text = DRAFT, head8 = H8) {
  const p = draftPaths(s.dir, "Acme/x", 5, head8);
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(p.file, text);
  return p;
}

describe("review dispatch: dry run", () => {
  it("is the default and announces the exact target and brief once, creating nothing", async () => {
    const { w, s } = setup();
    const out = (await runTick(w, s, { omitFlag: true })).stdout;
    assert.match(out, new RegExp(`dry-run Acme/x#5 review-requested: would create top-level Orca worktree prflow-review-${SLUG} on branch prflow-review/${SLUG} \\(orca-ide worktree create --repo id:rid1 --name prflow-review-${SLUG} --branch prflow-review/${SLUG} --pr 5 --no-parent --setup run --json, without the caller's Orca identity\\) for Acme/x, name it feature, then fetch origin pull/5/head, reset --hard ${HEAD}, verify HEAD, and launch a fresh Pi reviewer there; set status reviewing, comment reviewing ${H8}; draft Acme-x-5-${H8} to ${s.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/drafts/Acme-x-5/${H8}/review\\.md; brief review v2:\\n# Draft a review of Acme/x#5 at ${H8}`));
    assert.match(out, /run `\/pr review https:\/\/github\.com\/Acme\/widgets\/pull\/1 report`\. Report mode never publishes\./);
    assert.match(out, /Do not post anything to GitHub/);
    assert.match(out, /orca-ide worktree set --worktree active --workspace-status <id> --comment/);
    assert.match(out, /### path\/to\/other\.ext:10-14/);
    assert.match(out, new RegExp(`reset --hard ${HEAD}`));
    assert.match(out, /Use `GH_TOKEN="\$\(gh auth token -u octocat\)"` on every `gh` call\. Never run `gh auth switch`\./);
    assert.match(out, /Do not change your own workflow, skills, prompts, or agent configuration/);
    assert.deepEqual(w.effects, []);
    assert.deepEqual(s.openDispatches(), []);
    assert.equal(existsSync(join(s.dir, "drafts")), false);
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { omitFlag: true })).stdout, "");
  });

  it("is separate from dispatch.dryRun and actions.dryRun", async () => {
    const { w, s } = setup();
    const out = (await runTick(w, s, { actionsLive: true, dispatchLive: true })).stdout;
    assert.match(out, /dry-run Acme\/x#5 review-requested/);
    assert.deepEqual(w.effects, []);
  });

  it("points widget project PRs at the project context, read-only", async () => {
    const { w, s } = setup();
    const c = cfg();
    c.dispatch.projectContext = [{ path: "/docs/sync", folder: "proj", repos: ["acme/x"], owners: [] }];
    const out = (await runTick(w, s, { config: c })).stdout;
    assert.match(out, /Project context: this PR belongs to the shared project documented in `\/docs\/sync` \(`proj\/`\)\. Read `\/docs\/sync\/AGENTS\.md` and `\/docs\/sync\/proj\/AGENTS\.md`.*Do not edit, commit, or pull in that checkout\./);
  });

  it("caps announcements per tick at review.maxConcurrent", async () => {
    const prs = { [KEY]: REQ(), "Acme/x#6": REQ(), "Acme/x#7": REQ() };
    const { w, s } = setup({}, prs);
    const c = cfg({ startsPerTick: 5 });
    const out = (await runTick(w, s, { config: c })).stdout;
    assert.equal(out.match(/dry-run Acme\/x#\d review-requested/g)?.length, 2);
    w.clock += 15 * MIN;
    assert.match((await runTick(w, s, { config: c })).stdout, /dry-run Acme\/x#7 review-requested/);
  });

  it("asks once when Orca has no clone of the repo, and creates nothing", async () => {
    const { w, s } = setup({ worktrees: [] });
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /needs-decision Acme\/x#5 review-requested: the review needs its own worktree, but Orca has no single clone of Acme\/x/);
    assert.deepEqual(w.effects, []);
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { live: true })).stdout.includes("needs-decision"), false);
  });
});

describe("review dispatch: live", () => {
  it("writes the row, event, and meta before creating the worktree, then launches the reviewer there", async () => {
    const { w, s } = setup();
    const base = fakeTickDeps(w);
    const seen: string[] = [];
    const deps: TickDeps = {
      ...base,
      async createReviewWorktree(repoId, slug, pr) {
        seen.push(`${s.openDispatches()[0]?.state} ${events(s).at(-1)} meta=${existsSync(draftPaths(s.dir, "Acme/x", 5, H8).meta)}`);
        return base.createReviewWorktree(repoId, slug, pr);
      },
    };
    const out = (await runTick(w, s, { live: true, deps })).stdout;
    assert.match(seen[0] ?? "", /^planned dispatched #1: brief review v2: create top-level Orca worktree prflow-review-x-5 .*; set status reviewing, comment reviewing c0ffee11 meta=true$/);
    // The new worktree shows reviewing in the same tick, not Orca's default column until the next one.
    assert.deepEqual(w.effects, [`create-worktree ${SLUG}`, `name ${RPATH} feature`, `review-fetch ${RPATH} 5`, `review-reset ${RPATH} ${HEAD}`, `launch ${RWT}`, `status ${RPATH} reviewing reviewing ${H8} `]);
    const d = s.dispatch(1);
    assert.equal(d?.kind, "review-requested");
    assert.equal(d?.version, H8);
    assert.equal(d?.state, "launched");
    assert.equal(d?.worktree, RWT);
    assert.equal(d?.sessionHandle, "term_new1");
    assert.match(w.sent[0] ?? "", new RegExp(`^launch ${RWT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| # Draft a review of Acme/x#5`));
    const meta = JSON.parse(readFileSync(draftPaths(s.dir, "Acme/x", 5, H8).meta, "utf8"));
    assert.deepEqual([meta.id, meta.item, meta.headSha, meta.account, meta.dispatchId], [`Acme-x-5-${H8}`, KEY, HEAD, ME, 1]);
    assert.match(out, new RegExp(`review-started Acme/x#5 review-requested #1: reviewer term_new1 in ${RPATH} \\(Orca worktree prflow-review-${SLUG}\\); draft Acme-x-5-${H8} goes to `));
    assert.match(out, /## In flight \(1\)\n- Acme\/x#5 review-requested #1 \| session term_new1 \| launched/);
  });

  it("starts one reviewer per head: no second start for the same head, a new head waits, then starts with the earlier draft", async () => {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, [`create-worktree ${SLUG}`, `name ${RPATH} feature`, `review-fetch ${RPATH} 5`, `review-reset ${RPATH} ${HEAD}`, `launch ${RWT}`, `status ${RPATH} reviewing reviewing ${H8} `]);

    w.reviewPrs[KEY] = REQ({ head: NEW_HEAD });
    w.unpushed[RPATH] = 1; // Before fetch, the new head is not an ancestor in the realistic fake.
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 1, "the newer head waits for the open reviewer");
    assert.equal(w.effects.filter((e) => e.startsWith("review-fetch ")).length, 1, "no fetch or reset while the previous reviewer is busy");
    assert.equal(w.effects.filter((e) => e.startsWith("review-reset ")).length, 1);

    // The first reviewer saves its draft and goes idle.
    session(w, RWT, "term_new1", "done", w.clock + MIN, "draft saved");
    saveDraft(s);
    w.clock += 15 * MIN;
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /session-finished Acme\/x#5 review-requested #1: draft saved \(draft Acme-x-5-c0ffee11: verdict suggestion request-changes/);
    assert.equal(s.dispatch(1)?.state, "done");
    const second = s.findDispatch(KEY, "beefbeef", "review-requested");
    assert.equal(second?.state, "launched");
    assert.deepEqual(w.effects.slice(-4), [`review-fetch ${RPATH} 5`, `review-reset ${RPATH} ${NEW_HEAD}`, "send term_new1", `status ${RPATH} reviewing reviewing beefbeef `]);
    assert.match(w.sent.at(-1) ?? "", new RegExp(`## Earlier draft\\n\\nprflow saved a draft for the earlier head \`${H8}\``));
  });

  it("closes a finished reviewer whose terminal Orca orphaned, then sends the moved head to the same session", async () => {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    w.reviewPrs[KEY] = REQ({ head: NEW_HEAD });
    w.unpushed[RPATH] = 1;
    session(w, RWT, "term_new1", "done", w.clock + MIN, "I saved the draft");
    saveDraft(s);
    orphan(w, RWT, "term_new1");
    w.clock += 15 * MIN;
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /session-finished Acme\/x#5 review-requested #1: draft saved/);
    assert.equal(s.dispatch(1)?.state, "done");
    assert.equal(s.findDispatch(KEY, "beefbeef", "review-requested")?.state, "launched");
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 1);
    assert.ok(w.effects.includes("send term_new1"), "the idle reviewer gets the new head");
  });

  it("closes a reviewer with a saved draft even when Orca reports no agent state and its output keeps moving", async () => {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    saveDraft(s);
    w.agents = [];
    const t = (w.terminals[RWT] ?? [])[0] as { lastOutputAt: number | null };
    t.lastOutputAt = w.clock + MIN;
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "done");
  });

  it("does not close a user terminal when retrying a message-only dispatch", async () => {
    const reviewRow = { id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 };
    const { w, s } = setup({ worktrees: [MAIN, reviewRow], terminals: { [RWT]: [{ handle: "term_user", worktreeId: RWT, tabId: "tab-user", leafId: "l", agentIdentity: "pi", lastOutputAt: T0 }] }, agents: [{ orcaSessionId: "s-user", kind: "terminal", agent: "pi", state: "done", worktreeId: RWT, paneKey: "tab-user:l", lastAssistantMessage: null, updatedAt: T0 }], orcaFails: { send: "offline" } });
    await runTick(w, s, { live: true });
    w.orcaFails.send = "";
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.some((e) => e === "close term_user"), false);
    assert.ok(w.effects.includes("send term_user"));
  });

  it("rotates only a prflow-launched session after sessionReviews saved drafts", async () => {
    const { w, s } = setup();
    const c = cfg();
    c.review.sessionReviews = 1;
    await runTick(w, s, { live: true, config: c });
    session(w, RWT, "term_new1", "done", w.clock + MIN, "draft saved");
    saveDraft(s);
    w.reviewPrs[KEY] = REQ({ head: NEW_HEAD });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, config: c });
    assert.ok(w.effects.includes("close term_new1"));
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 2);
    assert.ok(w.effects.includes(`review-reset ${RPATH} ${NEW_HEAD}`));
  });

  it("caps open reviewers at review.maxConcurrent and says so once per tick", async () => {
    const prs = { [KEY]: REQ(), "Acme/x#6": REQ(), "Acme/x#7": REQ() };
    const { w, s } = setup({}, prs);
    const c = cfg({ startsPerTick: 5 });
    const out = (await runTick(w, s, { live: true, config: c })).stdout;
    assert.equal(w.effects.filter((e) => e.startsWith("create-worktree")).length, 2);
    assert.equal(out.match(/rail-tripped prflow: cap review\.maxConcurrent=2 reached; further reviewers wait/g)?.length, 1);
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, config: c });
    assert.equal(w.effects.filter((e) => e.startsWith("create-worktree")).length, 2);
  });

  it("starts normal requests before low-priority ones", async () => {
    const approved = REQ({ reviews: [review(alice, "APPROVED", AFTER, "lgtm", HEAD)], decision: "APPROVED" });
    const { w, s } = setup({}, { [KEY]: approved, "Acme/x#6": REQ() });
    const c = cfg();
    c.review.maxConcurrent = 1;
    const out = (await runTick(w, s, { live: true, config: c })).stdout;
    assert.deepEqual(w.effects.filter((e) => e.startsWith("create")), [`create-worktree x-6`]);
    assert.match(out, /- Acme\/x#5 "Fixture PR" \| review-requested: low priority \(already approved by alice\); merge=CLEAN/);
  });

  it("applies the global caps and pauses", async () => {
    const { w, s } = setup();
    pause(s, T0, { item: KEY }, "hold");
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, []);
    const c = cfg({ maxOpen: 1 });
    const t = setup({}, { [KEY]: REQ(), "Acme/x#6": REQ() });
    await runTick(t.w, t.s, { live: true, config: c });
    assert.equal(t.w.effects.filter((e) => e.startsWith("create")).length, 1);
    assert.match(events(t.s).join("\n"), /rail-tripped: cap maxOpen=1 reached/);
  });

  it("skips a head the legacy review watch already reviewed", async () => {
    const { w, s } = setup();
    importLegacy(s, T0, [{ source: "pr-watch", path: "/legacy", text: `Acme/x#5@${H8}\n` }]);
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, []);
  });

  it("fails the attempt when worktree creation fails, then retries", async () => {
    const { w, s } = setup({ orcaFails: { create: "name taken" } });
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /action-failed Acme\/x#5 review-requested #1: orca-ide worktree create: name taken/);
    assert.equal(s.dispatch(1)?.state, "failed");
    w.orcaFails = {};
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "launched");
    assert.equal(s.dispatch(1)?.attempts, 2);
  });

  it("refuses to reset a dirty or unknown persistent review worktree", async () => {
    const row = { id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 };
    for (const state of [{ dirty: { [RPATH]: 1 } }, { dirty: { [RPATH]: null } }]) {
      const { w, s } = setup({ worktrees: [MAIN, row], ...state });
      const out = (await runTick(w, s, { live: true })).stdout;
      assert.match(out, /will not reset it/);
      assert.equal(w.effects.some((e) => e.startsWith("review-reset") || e.startsWith("launch ")), false);
    }
  });

  it("does not hold the concurrency slot or repeat the wait event for a dirty planned tree", async () => {
    const row = { id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 };
    const prs = { [KEY]: REQ(), "Acme/x#6": REQ() };
    const { w, s } = setup({ worktrees: [MAIN, row], dirty: { [RPATH]: 1 } }, prs);
    const c = cfg();
    c.review.maxConcurrent = 1;
    await runTick(w, s, { live: true, config: c });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, config: c });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, config: c });
    assert.equal(s.dispatchesOfKind("review-requested", ["planned"]).length, 1);
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 1, "the other PR launches while the dirty PR stays planned");
    // The dirty row never resumes: its tree stays dirty, and the other reviewer holds the only slot.
    assert.equal(s.readEventsFrom(0).events.filter((e) => e.type === "dispatched" && e.detail?.includes("(was waiting)")).length, 0);
  });

  it("announces a waiting row's resume once, however many ticks its tree stays dirty", async () => {
    const row = { id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 };
    const { w, s } = setup({ worktrees: [MAIN, row], dirty: { [RPATH]: 1 } });
    for (let i = 0; i < 3; i++) {
      await runTick(w, s, { live: true });
      w.clock += 15 * MIN;
    }
    assert.equal(s.readEventsFrom(0).events.filter((e) => e.type === "dispatched" && e.detail?.includes("(was waiting)")).length, 1);
    assert.equal(events(s).filter((e) => /will not reset it/.test(e)).length, 1);
  });

  it("a waiting row checks review.maxConcurrent again before it starts", async () => {
    const row = { id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 };
    const prs = { [KEY]: REQ(), "Acme/x#6": REQ() };
    const { w, s } = setup({ worktrees: [MAIN, row], dirty: { [RPATH]: 1 } }, prs);
    const c = cfg();
    c.review.maxConcurrent = 1;
    await runTick(w, s, { live: true, config: c });
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 1);
    w.dirty = {};
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, config: c });
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 1, "the other reviewer is still open, so the cleaned PR waits");
    assert.equal(w.effects.some((e) => e.startsWith(`review-reset ${RPATH} `)), false);
  });

  it("finds a worktree created by a lost reply by its branch, and never creates a second one", async () => {
    const { w, s } = setup({ createReply: { ok: true, result: {} }, createLost: true });
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "failed");
    assert.match(s.dispatch(1)?.detail ?? "", /did not report or list it/);
    // Orca lists it now.
    w.worktrees.push({ id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.filter((e) => e.startsWith("create-worktree")).length, 1);
    assert.equal(w.effects.filter((e) => e.startsWith("launch ")).length, 1);
    assert.equal(s.dispatch(1)?.worktree, RWT);
  });
});

describe("review worktree lineage", () => {
  it("drops a parent Orca still recorded on a new review worktree, and reports a failure once", async () => {
    const nested = { ok: true, result: { worktree: { id: RWT, path: RPATH }, lineage: null, workspaceLineage: { parentWorkspaceKey: "folder:pingu" } } };
    const { w, s } = setup({ createReply: nested });
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects.slice(0, 2), [`create-worktree ${SLUG}`, `unparent ${RPATH}`]);
    assert.equal(s.dispatch(1)?.state, "launched", "the review goes on");

    const { w: top, s: topStore } = setup();
    await runTick(top, topStore, { live: true });
    assert.equal(top.effects.some((e) => e.startsWith("unparent ")), false, "a top-level create needs no unparent call");

    const { w: bad, s: badStore } = setup({ createReply: nested, orcaFails: { unparent: "offline" } });
    await runTick(bad, badStore, { live: true });
    assert.equal(badStore.dispatch(1)?.state, "launched");
    assert.deepEqual(events(badStore).filter((e) => e.startsWith("action-failed")), [`action-failed: orca-ide worktree set ${RPATH} --no-parent: offline`]);
  });
});

describe("review dispatch: monitor and recovery", () => {
  async function launched() {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    return { w, s };
  }

  it("keeps a busy reviewer past busyWaitMinutes while it shows activity", async () => {
    const { w, s } = await launched();
    for (let i = 1; i <= 6; i++) {
      w.clock += 15 * MIN;
      session(w, RWT, "term_new1", "working", w.clock - MIN);
      await runTick(w, s, { live: true });
    }
    assert.equal(s.dispatch(1)?.state, "working");
    assert.deepEqual(w.effects.slice(0, 5), [`create-worktree ${SLUG}`, `name ${RPATH} feature`, `review-fetch ${RPATH} 5`, `review-reset ${RPATH} ${HEAD}`, `launch ${RWT}`]);
  });

  it("nudges once when idle without a draft, then retries in the same worktree with a fresh session", async () => {
    const { w, s } = await launched();
    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN, "I stopped early");
    let out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /nudged Acme\/x#5 review-requested #1: idle with review-requested unfinished/);
    assert.match(w.sent.at(-1) ?? "", /^term_new1 \| prflow: review-requested on Acme\/x#5 \| prflow: the draft review of Acme\/x#5 at c0ffee11 .* is not saved yet\. prflow found no usable draft at `.*review\.md`\./);

    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN, "still stopped");
    out = (await runTick(w, s, { live: true })).stdout;
    // Stale, then the same tick retries: close the idle session, launch a fresh one, no new worktree.
    assert.match(out, /session-stale Acme\/x#5 review-requested #1: idle again after a nudge/);
    assert.equal(s.dispatch(1)?.state, "launched");
    assert.ok(w.effects.includes("send term_new1"));
    assert.ok(w.effects.includes("close term_new1"));
    assert.equal(w.effects.filter((e) => e === `launch ${RWT}`).length, 2);
    assert.equal(s.dispatch(1)?.attempts, 2);
    assert.match(w.sent.at(-1) ?? "", /## Previous attempt\n\nThis is attempt 2\. Attempt 1 ended: idle again after a nudge/);
  });

  it("nudges with the parse error when the draft is malformed", async () => {
    const { w, s } = await launched();
    saveDraft(s, "Verdict: maybe\n");
    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN);
    await runTick(w, s, { live: true });
    assert.match(w.sent.at(-1) ?? "", /it does not parse \(first line must be <!-- prflow review draft v1 -->; missing or unknown Verdict line/);
  });

  it("abandons after maxAttempts and pauses the item", async () => {
    const { w, s } = await launched();
    for (let i = 0; i < 3; i++) {
      w.clock += 15 * MIN;
      w.terminals[RWT] = [];
      await runTick(w, s, { live: true });
      w.clock += 15 * MIN;
      await runTick(w, s, { live: true });
    }
    assert.equal(s.dispatch(1)?.state, "abandoned");
    assert.match(s.item(KEY)?.pausedReason ?? "", /dispatch #1 abandoned/);
    assert.ok(types(s).includes("abandoned"));
    assert.equal(w.effects.filter((e) => e.startsWith("create-worktree")).length, 1);
  });

  it("trips the loop breaker across restarts of the same head and pauses the item", async () => {
    const { w, s } = setup();
    const c = cfg({ loopSameVersion: 2, maxAttempts: 5 });
    await runTick(w, s, { live: true, config: c });
    for (let i = 0; i < 2; i++) {
      w.terminals[RWT] = [];
      w.clock += 15 * MIN;
      await runTick(w, s, { live: true, config: c });
    }
    assert.match(s.item(KEY)?.pausedReason ?? "", /^loop breaker: 2 starts for this version in 24h \(limit 2\)/);
    assert.equal(w.effects.filter((e) => e.startsWith("launch")).length, 2);
    assert.ok(types(s).includes("rail-tripped"));
  });

  it("rewrites meta.json when a crash came between the row and the meta, before creating anything", async () => {
    const { w, s } = setup({ terminals: {} });
    // A busy session in an existing review worktree keeps the dispatch planned.
    w.worktrees.push({ id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 });
    w.terminals[RWT] = [{ handle: "term_busy", worktreeId: RWT, tabId: "tb", leafId: "l", agentIdentity: "pi", lastOutputAt: T0 }];
    w.agents = [{ orcaSessionId: "sb", kind: "terminal", agent: "pi", state: "working", worktreeId: RWT, paneKey: "tb:l", lastAssistantMessage: null, updatedAt: T0 }];
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "planned");
    const meta = draftPaths(s.dir, "Acme/x", 5, H8).meta;
    rmSync(meta);
    session(w, RWT, "term_busy", "done", w.clock);
    w.clock += 15 * MIN;
    const base = fakeTickDeps(w);
    const seen: boolean[] = [];
    await runTick(w, s, { live: true, deps: { ...base, async sendToAgent(h, sub, b) { seen.push(existsSync(meta)); return base.sendToAgent(h, sub, b); } } });
    assert.deepEqual(seen, [true]);
    assert.equal(JSON.parse(readFileSync(meta, "utf8")).dispatchId, 1);
  });

  it("goes stale when the lease runs out with no activity", async () => {
    const { w, s } = await launched();
    w.clock += 46 * MIN;
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /session-stale Acme\/x#5 review-requested #1/);
  });

  it("recover gives an open reviewer a fresh session in the same worktree", async () => {
    const { w, s } = await launched();
    session(w, RWT, "term_new1", "done", w.clock);
    assert.match(recover(s, w.clock, 1), /recovered dispatch #1/);
    assert.equal(s.dispatch(1)?.state, "stale");
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "launched");
    assert.ok(w.effects.includes("close term_new1"));
    assert.equal(w.effects.filter((e) => e === `launch ${RWT}`).length, 2);
  });
});

describe("review dispatch: draft and reap", () => {
  async function drafted(text = DRAFT) {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN, "Draft written.");
    saveDraft(s, text);
    return { w, s };
  }

  it("records review-drafted and preserves the clean worktree while the PR is open", async () => {
    const { w, s } = await drafted();
    const out = (await runTick(w, s, { live: true })).stdout;
    const id = `Acme-x-5-${H8}`;
    assert.match(out, new RegExp(`review-drafted Acme/x#5 review-requested #1: draft ${id}: verdict suggestion request-changes, 2 inline comments, .*/drafts/Acme-x-5/${H8}/review\\.md`));
    assert.doesNotMatch(out, /archived Acme\/x#5/);
    assert.equal(w.effects.some((e) => e.startsWith("archive") || e.startsWith("delete-branch")), false);
    assert.match(out, new RegExp(`## Needs your decision \\(1\\)\\n- Acme/x#5 "Fixture PR" \\| review-requested: .* \\| next: review draft ready \\(verdict suggestion request-changes, 2 inline comments\\): \`prflow review show ${id}\`; nothing is posted until you ask for \`prflow review post ${id} --yes\` \\| owner: you`));
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { live: true })).stdout, "");
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });

  it("never archives a worktree whose draft is missing", async () => {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    // The review request goes away; the session finished without a draft.
    delete w.reviewPrs[KEY];
    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN);
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.equal(s.dispatch(1)?.state, "done");
    assert.doesNotMatch(out, /archived Acme\/x#5/);
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
    assert.ok((w.worktrees as { path: string }[]).some((x) => x.path === RPATH));
  });

  it("never archives a dirty review worktree or one with unpushed commits", async () => {
    const { w, s } = await drafted();
    w.dirty[RPATH] = 2;
    let out = (await runTick(w, s, { live: true })).stdout;
    assert.doesNotMatch(out, /archived Acme\/x#5/);
    w.dirty[RPATH] = 0;
    w.unpushed[RPATH] = 1;
    w.clock += 15 * MIN;
    out = (await runTick(w, s, { live: true })).stdout;
    assert.doesNotMatch(out, /archived Acme\/x#5/);
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });

  it("waits while any Pi session in the review worktree is busy", async () => {
    const { w, s } = await drafted();
    (w.terminals[RWT] ??= []).push({ handle: "term_other", worktreeId: RWT, tabId: "tabX", leafId: "l", agentIdentity: "pi", lastOutputAt: w.clock });
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "done");
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });

  it("only announces the reap in review dry run", async () => {
    const { w, s } = await drafted();
    const out = (await runTick(w, s)).stdout;
    assert.doesNotMatch(out, /would archive/);
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });

  it("keeps the worktree and asks when archiving fails", async () => {
    const { w, s } = await drafted();
    w.archiveFails[RPATH] = "busy";
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.doesNotMatch(out, /could not archive/);
    assert.equal(w.effects.filter((e) => e.startsWith("archive")).length, 0);
  });
});

describe("review worktree status sync", () => {
  const row = (status: string | null = null, comment: string | null = null, isUnread: boolean | null = false) => ({ id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5, workspaceStatus: status, comment, isUnread });

  it("writes only status/comment differences and dry-run only announces", async () => {
    const comment = `queued ${H8}`;
    const { w, s } = setup({ worktrees: [MAIN, row("reviewing", comment)] });
    await runTick(w, s, { live: true });
    // Status sync writes nothing; the only write marks the reviewer launched this tick.
    assert.deepEqual(w.effects.filter((e) => e.startsWith("status ")), [`status ${RPATH} reviewing reviewing ${H8} `]);

    const { w: dryWorld, s: dryStore } = setup({ worktrees: [MAIN, row()] });
    const out = (await runTick(dryWorld, dryStore)).stdout;
    assert.match(out, /would set .*status reviewing, comment queued c0ffee11/);
    assert.equal(dryWorld.effects.some((e) => e.startsWith("status ")), false);
  });

  it("marks saved drafts unread and submitted reviews read once per head", async () => {
    const draftWorld = world({ reviewPrs: { [KEY]: REQ() }, worktrees: [MAIN, row("reviewing", `draft: request-changes, 2 inline, not posted`)] });
    const draftStore = tempStore();
    saveDraft(draftStore);
    await runTick(draftWorld, draftStore, { live: true });
    assert.ok(draftWorld.effects.includes(`status ${RPATH} review-changes draft: request-changes, 2 inline, not posted --unread`));
    draftWorld.clock += 15 * MIN;
    await runTick(draftWorld, draftStore, { live: true });
    assert.equal(draftWorld.effects.filter((e) => e.endsWith("--unread")).length, 1);

    const posted = review(user(ME), "APPROVED", AFTER, "approved", HEAD);
    const postedWorld = world({ reviewPrs: { [KEY]: REQ({ reviews: [posted] }) }, worktrees: [MAIN, row("review-approved", `approved at ${H8}`, true)] });
    const postedStore = tempStore();
    await runTick(postedWorld, postedStore, { live: true });
    assert.ok(postedWorld.effects.includes(`status ${RPATH} review-approved approved at ${H8} --read`));
    postedWorld.clock += 15 * MIN;
    await runTick(postedWorld, postedStore, { live: true });
    assert.equal(postedWorld.effects.filter((e) => e.endsWith("--read")).length, 1);
  });

  it("records one action-failed event for a repeated Orca status failure", async () => {
    const { w, s } = setup({ worktrees: [MAIN, row()] });
    const base = fakeTickDeps(w);
    let attempted = 0;
    const deps = { ...base, async setReviewWorktree() { attempted++; return { ok: false, stdout: "", stderr: "offline" }; } };
    await runTick(w, s, { live: true, deps });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, deps });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, deps });
    const failures = s.readEventsFrom(0).events.filter((x) => x.type === "action-failed");
    assert.equal(failures.length, 2, "two distinct status/comment pairs each report one failure");
    assert.equal(attempted, 4, "status writes retry on later ticks even after failure (one more right after the launch)");
  });

  it("names the review worktree after the PR head branch, only when it differs, and dry run only announces", async () => {
    const { w, s } = setup({ worktrees: [MAIN, { ...row(), displayName: `prflow-review-${SLUG}` }] });
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects.filter((e) => e.startsWith("name ")), [`name ${RPATH} feature`]);
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.filter((e) => e.startsWith("name ")).length, 1, "no rewrite once the name matches");

    const { w: dryWorld, s: dryStore } = setup({ worktrees: [MAIN, row()] });
    const out = (await runTick(dryWorld, dryStore)).stdout;
    assert.match(out, /would set \/w\/review\/prflow-review-x-5 display name feature \(was unset\)/);
    assert.equal(dryWorld.effects.some((e) => e.startsWith("name ")), false);
  });

  it("follows a renamed head branch and reports a failed rename once", async () => {
    const { w, s } = setup({ worktrees: [MAIN, { ...row(), displayName: "old-branch" }] });
    w.orcaFails.name = "offline";
    await runTick(w, s, { live: true });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.filter((e) => e === `name ${RPATH} feature`).length, 2, "retried on the next tick");
    assert.equal(s.readEventsFrom(0).events.filter((e) => e.type === "action-failed" && /--display-name feature: offline/.test(e.detail ?? "")).length, 1);
    delete w.orcaFails.name;
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal((w.worktrees.find((x) => (x as { path?: string }).path === RPATH) as { displayName?: string }).displayName, "feature");
  });

  it("fetches a missing open-PR snapshot and uses linkedPr for Orca-suffixed branches", async () => {
    const suffixRow = { ...row(), branch: `refs/heads/prflow-review/${SLUG}-2` };
    const { w, s } = setup({ prs: { [KEY]: REQ() }, reviewPrs: {}, worktrees: [MAIN, suffixRow] });
    await runTick(w, s, { live: true });
    assert.ok(w.calls.some((c) => c[0] === "gh" && c.includes("api") && c.some((x) => x.includes("query=query"))));
    assert.ok(w.effects.some((e) => e === `status ${RPATH} reviewing queued ${H8} `), JSON.stringify({ effects: w.effects, calls: w.calls }));
  });
});

describe("review draft revisions", () => {
  const APPROVE = DRAFT.replace("Verdict: request-changes", "Verdict: approve").replace("One blocking finding: F1 in src/a.ts.", "Fixed; approving.");
  /** prflow posted the draft as it is now (revision `rev`). */
  function markPosted(s: Store, text: string, rev: number, event: string) {
    const p = draftPaths(s.dir, "Acme/x", 5, H8);
    recordPosted(s, p, { rev, hash: textHash(text), event, at: T0, comments: parseDraft(text).comments.map(commentKey) });
  }

  it("a draft rewritten after its post is a new revision that wins status sync until it is posted", async () => {
    const { w, s } = setup();
    await runTick(w, s, { live: true });
    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN, "Draft written.");
    saveDraft(s);
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "done");

    // Posted as COMMENT; GitHub shows it.
    markPosted(s, DRAFT, 1, "COMMENT");
    w.reviewPrs[KEY] = REQ({ requests: [], reviews: [review(user(ME), "COMMENTED", AFTER, "x", HEAD)] });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.at(-1), `status ${RPATH} reviewing commented at ${H8} --read`);

    // Noel tells the reviewer to approve; it rewrites the same file.
    saveDraft(s, APPROVE);
    w.clock += 15 * MIN;
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, new RegExp(`review-drafted Acme/x#5 review-requested #1: revision r2 \\(r1 posted\\): draft Acme-x-5-${H8}: verdict suggestion approve`));
    assert.equal(w.effects.at(-1), `status ${RPATH} review-approved draft r2: approve, not posted --unread`);
    w.clock += 15 * MIN;
    const before = w.effects.length;
    assert.doesNotMatch((await runTick(w, s, { live: true })).stdout, /review-drafted/, "one event per revision");
    assert.equal(w.effects.length, before, "the newer revision keeps its status; the older COMMENT does not win it back");

    // Revision 2 is posted as APPROVE; the posted review wins again.
    markPosted(s, APPROVE, 2, "APPROVE");
    w.reviewPrs[KEY] = REQ({ requests: [], reviews: [review(user(ME), "COMMENTED", AFTER, "x", HEAD), review(user(ME), "APPROVED", "2026-01-10T14:00:00Z", "y", HEAD)] });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.at(-1), `status ${RPATH} review-approved approved at ${H8} --read`);
  });
});

describe("review idle session closing", () => {
  async function idleFixture() {
    const { w, s } = setup();
    const c = cfg();
    c.review.idleCloseHours = 1;
    await runTick(w, s, { live: true, config: c });
    session(w, RWT, "term_new1", "done", w.clock + MIN, "draft saved");
    saveDraft(s);
    w.clock += 2 * 60 * MIN;
    return { w, s, c };
  }

  it("closes only a prflow-launched terminal in live mode", async () => {
    const { w, s, c } = await idleFixture();
    const out = (await runTick(w, s, { live: true, config: c })).stdout;
    assert.ok(w.effects.includes("close term_new1"), JSON.stringify({ effects: w.effects, events: s.readEventsFrom(0).events }));
    assert.equal(out.includes("would close idle reviewer"), false);
  });

  it("announces idle close in dry-run mode without closing", async () => {
    const { w, s, c } = await idleFixture();
    const out = (await runTick(w, s, { config: c })).stdout;
    assert.match(out, /would close idle reviewer term_new1/);
    assert.equal(w.effects.some((e) => e.startsWith("close ")), false);
  });

  it("records an action failure and continues when closing a reviewer terminal throws", async () => {
    const { w, s, c } = await idleFixture();
    const base = fakeTickDeps(w);
    const deps = { ...base, async closeTerminal() { throw new Error("offline"); } };
    const out = (await runTick(w, s, { live: true, config: c, deps })).stdout;
    assert.match(out, /could not close idle reviewer term_new1: offline/);
    assert.equal(s.readEventsFrom(0).events.filter((e) => e.type === "action-failed").length, 1);
  });

  it("does not try to close a messaged chat session as a terminal", async () => {
    const chat = { orcaSessionId: "chat-id", kind: "chat", agent: "pi", state: "done", worktreeId: RWT, paneKey: "chat", lastAssistantMessage: null, updatedAt: T0 };
    const reviewRow = { id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 };
    const { w, s } = setup({ worktrees: [MAIN, reviewRow], agents: [chat], terminals: { [RWT]: [] } });
    const c = cfg();
    c.review.idleCloseHours = 1;
    await runTick(w, s, { live: true, config: c });
    (w.agents[0] as { updatedAt: number }).updatedAt = T0 + MIN;
    saveDraft(s);
    w.clock += 2 * 60 * MIN;
    await runTick(w, s, { live: true, config: c });
    assert.equal(s.dispatch(1)?.state, "done");
    assert.equal(w.effects.some((e) => e.startsWith("close ")), false);
  });
});

describe("review worktree archive-on-close", () => {
  async function closedReview(overrides: Partial<World> = {}) {
    const { w, s } = setup(overrides);
    await runTick(w, s, { live: true, config: cfg({}, true) });
    session(w, RWT, "term_new1", "done", w.clock + MIN, "draft saved");
    saveDraft(s);
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true, config: cfg({}, true) });
    w.reviewPrs[KEY] = REQ({ state: "CLOSED" });
    w.refs["pr view 5 -R acme/x --json number,state,title,url,headRefOid"] = { ok: true, stdout: JSON.stringify({ number: 5, state: "CLOSED", title: "Fixture PR", url: "https://github.com/Acme/x/pull/5", headRefOid: HEAD }), stderr: "" };
    w.clock += 15 * MIN;
    return { w, s };
  }

  it("archives a clean review worktree only after PR close and closes its idle reviewer", async () => {
    const { w, s } = await closedReview();
    w.unpushed[RPATH] = 2; // Closed review worktrees skip the unfetched-PR-head ancestry check.
    const before = w.effects.length;
    const out = (await runTick(w, s, { live: true, actionsLive: true, config: cfg({}, true) })).stdout;
    assert.match(out, /archived Acme\/x#5 cleanup/);
    assert.deepEqual(w.effects.slice(before), ["close term_new1", `archive ${RPATH}`, "delete-branch prflow-review/x-5"]);
  });

  it("asks before archiving when an idle Pi terminal was not launched by prflow", async () => {
    const { w, s } = await closedReview();
    (w.terminals[RWT] ??= []).push({ handle: "term_user", worktreeId: RWT, tabId: "tab-user", leafId: "l", agentIdentity: "pi", lastOutputAt: w.clock });
    w.agents.push({ orcaSessionId: "s-user", kind: "terminal", agent: "pi", state: "done", worktreeId: RWT, paneKey: "tab-user:l", lastAssistantMessage: null, updatedAt: w.clock });
    const out = (await runTick(w, s, { live: true, actionsLive: true, config: cfg({}, true) })).stdout;
    assert.match(out, /did not launch/);
    assert.equal(w.effects.some((e) => e.startsWith("close ") || e.startsWith("archive ")), false);
  });

  it("keeps a closed-PR review worktree when a reviewer session is busy", async () => {
    const { w, s } = await closedReview();
    session(w, RWT, "term_new1", "working", w.clock);
    const out = (await runTick(w, s, { live: true, config: cfg({}, true) })).stdout;
    assert.match(out, /busy Pi session/);
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });

  it("archives a merged PR's review worktree whose idle reviewer terminal Orca orphaned", async () => {
    const { w, s } = await closedReview();
    orphan(w, RWT, "term_new1");
    (w.terminals[RWT] ??= []).push({ handle: "term_shell", worktreeId: RWT, tabId: `pty:${RWT}@@sh`, leafId: `pty:${RWT}@@sh`, orphaned: true, recordedPaneKey: "old:shell", lastOutputAt: null });
    const out = (await runTick(w, s, { live: true, actionsLive: true, config: cfg({}, true) })).stdout;
    assert.doesNotMatch(out, /busy Pi session/);
    assert.match(out, /archived Acme\/x#5 cleanup/);
  });

  it("keeps a closed-PR review worktree when the tree is dirty", async () => {
    const { w, s } = await closedReview();
    w.dirty[RPATH] = 1;
    const out = (await runTick(w, s, { live: true, config: cfg({}, true) })).stdout;
    assert.match(out, /1 uncommitted file/);
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });
});

describe("tick can never post a review", () => {
  it("makes only read-only gh calls and no review write, even with every switch live and a draft saved", async () => {
    const { w, s } = setup();
    const base = fakeTickDeps(w);
    const used = new Set<string>();
    const ghCalls: string[][] = [];
    const deps = new Proxy(base, {
      get(target, prop, recv) {
        used.add(String(prop));
        const v = Reflect.get(target, prop, recv);
        if (prop === "gh")
          return async (login: string, args: string[]) => {
            ghCalls.push(args);
            const { assertReadOnly } = await import("../scripts/adapters/gh.ts");
            assertReadOnly(args);
            return (v as TickDeps["gh"])(login, args);
          };
        return v;
      },
    }) as TickDeps;
    const all = { live: true, dispatchLive: true, actionsLive: true, deps };
    await runTick(w, s, all);
    w.clock += 15 * MIN;
    session(w, RWT, "term_new1", "done", w.clock - MIN);
    saveDraft(s);
    await runTick(w, s, all);
    w.clock += 15 * MIN;
    await runTick(w, s, all);
    assert.equal(s.dispatch(1)?.state, "done");
    assert.equal(used.has("postReview"), false);
    assert.equal(ghCalls.some((a) => a.some((x) => /\/reviews\b|addPullRequestReview|submitPullRequestReview|--method|-X/.test(x))), false);
    assert.equal(types(s).includes("review-posted"), false);
  });

  it("has no review write in TickDeps, and no tick module imports the post path", () => {
    // @ts-expect-error TickDeps has no postReview; only PostDeps (prflow review post) does.
    const k: keyof TickDeps = "postReview";
    assert.equal(k, "postReview");
    for (const f of ["tick.ts", "agents.ts", "review.ts", "actions.ts", "dispatch.ts", "scan.ts", "commands.ts", "store.ts"]) {
      const src = readFileSync(join(SKILL_DIR, "scripts", f), "utf8");
      assert.doesNotMatch(src, /review-cmd|realPostDeps|postReview|reviewPostArgs|assertReviewPost/, f);
    }
    const cli = readFileSync(join(SKILL_DIR, "scripts", "prflow.ts"), "utf8");
    assert.equal(cli.match(/realPostDeps\(/g)?.length, 1);
    assert.match(cli, /if \(sub === "post" && positionals\.length === 3\) \{[\s\S]*?realPostDeps\(resolve\(stateDir\)\)/);
  });
});

describe("report noise", () => {
  it("annotates a reprinted row with what changed", async () => {
    const s = tempStore();
    const w = world({ prs: { "Acme/x#1": prResponse({ merge: "BEHIND", decision: null }) } });
    await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    w.prs["Acme/x#1"] = prResponse({ merge: "BEHIND", decision: null, head: NEW_HEAD, title: "Renamed" });
    w.clock += 15 * MIN;
    const out = (await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout;
    assert.match(out, /- Acme\/x#1 "Renamed" \| behind: merge=BEHIND review=NONE checks=green \| changed: new head beefbeef, retitled \| next:/);
  });

  it("does not reprint for a new head alone while checks run, and notes it once they finish", async () => {
    const s = tempStore();
    const pending = [ok("lint"), run("e2e", "IN_PROGRESS", null)];
    const w = world({ reviewPrs: { [KEY]: REQ({ checks: pending }) } });
    const first = (await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout;
    assert.match(first, /review-requested: merge=CLEAN review=REVIEW_REQUIRED checks=pending/);
    w.reviewPrs[KEY] = REQ({ checks: pending, head: NEW_HEAD });
    w.clock += 15 * MIN;
    assert.equal((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, "");
    w.reviewPrs[KEY] = REQ({ checks: [ok("lint"), ok("e2e")], head: NEW_HEAD });
    w.clock += 15 * MIN;
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, /\| changed: new head beefbeef, checks finished \|/);
  });

  it("does not reprint while a reviewed PR's new head waits for required checks", async () => {
    const s = tempStore();
    const w = world({ reviewPrs: { [KEY]: REQ() } });
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, /review-requested/);
    w.reviewPrs[KEY] = REQ({ head: NEW_HEAD, checks: [run("build", "IN_PROGRESS", null, null, true)] });
    w.clock += 15 * MIN;
    assert.equal((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, "");
    w.reviewPrs[KEY] = REQ({ head: NEW_HEAD, checks: [ok("build", true)] });
    w.clock += 15 * MIN;
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, /\| review-requested: merge=CLEAN review=REVIEW_REQUIRED checks=green \| changed: new head beefbeef \| next:/);
  });

  it("still reprints when a pending PR gets new comments", async () => {
    const s = tempStore();
    const pending = [run("e2e", "IN_PROGRESS", null)];
    const w = world({ reviewPrs: { [KEY]: REQ({ checks: pending }) } });
    await tick(fakeTickDeps(w), s, cfg(), { dryRun: true });
    w.reviewPrs[KEY] = REQ({ checks: pending, comments: [{ createdAt: AFTER, author: user("bob") }] });
    w.clock += 15 * MIN;
    assert.match((await tick(fakeTickDeps(w), s, cfg(), { dryRun: true })).stdout, /\| changed: new comments or reviews \|/);
  });
});
