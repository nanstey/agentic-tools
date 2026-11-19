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
import type { Store } from "../scripts/store.ts";
import { tick, type TickDeps } from "../scripts/tick.ts";
import { AFTER, alice, DRAFT, HEAD, ME, ok, prResponse, review, run, user } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, T0, tempStore, world, type World } from "./state-helpers.ts";

const TEMPLATES = loadTemplates(join(SKILL_DIR, "templates", "briefs"));
const KEY = "Acme/x#5";
const H8 = HEAD.slice(0, 8);
const SLUG = `x-5-${H8}`;
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
    assert.match(out, new RegExp(`dry-run Acme/x#5 review-requested: would create Orca worktree prflow-review-${SLUG} on branch prflow-review/${SLUG} \\(orca-ide worktree create --repo id:rid1 --name prflow-review-${SLUG} --branch prflow-review/${SLUG} --pr 5 --no-parent --setup skip --json\\) for Acme/x, then launch a fresh Pi reviewer there; draft Acme-x-5-${H8} to ${s.dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/drafts/Acme-x-5/${H8}/review\\.md; brief review v1:\\n# Draft a review of Acme/x#5 at ${H8}`));
    assert.match(out, /run `\/pr review https:\/\/github\.com\/Acme\/widgets\/pull\/1 report`\. Report mode never publishes\./);
    assert.match(out, /Do not post anything to GitHub/);
    assert.match(out, new RegExp(`git reset --hard ${HEAD}`));
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
    assert.match(seen[0] ?? "", /^planned dispatched #1: brief review v1: create Orca worktree prflow-review-x-5-c0ffee11 .* meta=true$/);
    assert.deepEqual(w.effects, [`create-worktree ${SLUG}`, `launch ${RWT}`]);
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
    assert.deepEqual(w.effects, [`create-worktree ${SLUG}`, `launch ${RWT}`]);

    w.reviewPrs[KEY] = REQ({ head: NEW_HEAD });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.length, 2, "the newer head waits for the open reviewer");

    // The first reviewer saves its draft and goes idle.
    session(w, RWT, "term_new1", "done", w.clock + MIN, "draft saved");
    saveDraft(s);
    w.clock += 15 * MIN;
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /session-finished Acme\/x#5 review-requested #1: draft saved \(draft Acme-x-5-c0ffee11: verdict suggestion request-changes/);
    assert.equal(s.dispatch(1)?.state, "done");
    const second = s.findDispatch(KEY, "beefbeef", "review-requested");
    assert.equal(second?.state, "launched");
    assert.deepEqual(w.effects.slice(2), ["close term_new1", `archive ${RPATH}`, "delete-branch prflow-review/x-5-c0ffee11", "create-worktree x-5-beefbeef", "launch rid1::/w/review/prflow-review-x-5-beefbeef"]);
    assert.match(w.sent.at(-1) ?? "", new RegExp(`## Earlier draft\\n\\nprflow saved a draft for the earlier head \`${H8}\``));
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
    assert.deepEqual(w.effects.filter((e) => e.startsWith("create")), [`create-worktree x-6-${H8}`]);
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

  it("finds a worktree created by a lost reply by its branch, and never creates a second one", async () => {
    const { w, s } = setup({ createReply: { ok: true, result: {} }, createLost: true });
    await runTick(w, s, { live: true });
    assert.equal(s.dispatch(1)?.state, "failed");
    assert.match(s.dispatch(1)?.detail ?? "", /did not report or list it/);
    // Orca lists it now.
    w.worktrees.push({ id: RWT, path: RPATH, branch: `refs/heads/prflow-review/${SLUG}`, projectId: "github:Acme/x", linkedPR: 5 });
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.deepEqual(w.effects, [`create-worktree ${SLUG}`, `launch ${RWT}`]);
    assert.equal(s.dispatch(1)?.worktree, RWT);
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
    assert.deepEqual(w.effects, [`create-worktree ${SLUG}`, `launch ${RWT}`]);
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
    assert.deepEqual(w.effects.slice(2), ["send term_new1", "close term_new1", `launch ${RWT}`]);
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
    assert.deepEqual(w.effects.slice(2), ["close term_new1", `launch ${RWT}`]);
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

  it("records review-drafted, then closes the session, archives the clean worktree, and deletes its branch", async () => {
    const { w, s } = await drafted();
    const out = (await runTick(w, s, { live: true })).stdout;
    const id = `Acme-x-5-${H8}`;
    assert.match(out, new RegExp(`review-drafted Acme/x#5 review-requested #1: draft ${id}: verdict suggestion request-changes, 2 inline comments, .*/drafts/Acme-x-5/${H8}/review\\.md`));
    assert.match(out, new RegExp(`archived Acme/x#5 review-requested #1: review worktree ${RPATH} archived after draft ${id} was saved \\(deleted local branch prflow-review/${SLUG}\\)`));
    assert.deepEqual(w.effects.slice(2), ["close term_new1", `archive ${RPATH}`, `delete-branch prflow-review/${SLUG}`]);
    assert.match(out, new RegExp(`## Needs your decision \\(1\\)\\n- Acme/x#5 "Fixture PR" \\| review-requested: .* \\| next: review draft ready \\(verdict suggestion request-changes, 2 inline comments\\): \`prflow review show ${id}\`; nothing is posted until you ask for \`prflow review post ${id} --yes\` \\| owner: you`));
    w.clock += 15 * MIN;
    assert.equal((await runTick(w, s, { live: true })).stdout, "");
    assert.equal(w.effects.length, 5);
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
    assert.match(out, new RegExp(`needs-decision Acme/x#5 review-requested: reviewer #1 finished but saved no draft at .*review\\.md\\. prflow will not archive its worktree ${RPATH}`));
    assert.equal(w.effects.some((e) => e.startsWith("archive") || e.startsWith("close")), false);
  });

  it("never archives a dirty review worktree or one with unpushed commits", async () => {
    const { w, s } = await drafted();
    w.dirty[RPATH] = 2;
    let out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, new RegExp(`needs-decision .*review worktree ${RPATH} has 2 uncommitted file\\(s\\); draft Acme-x-5-${H8} is saved\\. prflow will not archive it`));
    w.dirty[RPATH] = 0;
    w.unpushed[RPATH] = 1;
    w.clock += 15 * MIN;
    out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /1 unpushed commit\(s\)/);
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
    assert.match(out, new RegExp(`dry-run Acme/x#5 review-requested: would close term_new1, then archive ${RPATH}, then delete local branch prflow-review/${SLUG}`));
    assert.equal(w.effects.some((e) => e.startsWith("archive")), false);
  });

  it("keeps the worktree and asks when archiving fails", async () => {
    const { w, s } = await drafted();
    w.archiveFails[RPATH] = "busy";
    const out = (await runTick(w, s, { live: true })).stdout;
    assert.match(out, /needs-decision .*could not archive review worktree .*: busy; prflow retries next tick/);
    delete w.archiveFails[RPATH];
    w.clock += 15 * MIN;
    await runTick(w, s, { live: true });
    assert.equal(w.effects.filter((e) => e.startsWith("archive")).length, 2);
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
