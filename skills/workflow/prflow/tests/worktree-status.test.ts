import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertOrca, worktreeStatusArgs } from "../scripts/adapters/orca.ts";
import { parsePr } from "../scripts/adapters/gh.ts";
import { DEFAULT_STATUSES, type Config } from "../scripts/core/config.ts";
import { closedPrColumn, isIgnored, openPrColumn, worktreeColumn } from "../scripts/core/worktree-status.ts";
import type { PrSnapshot } from "../scripts/core/types.ts";
import type { Store } from "../scripts/store.ts";
import { tick } from "../scripts/tick.ts";
import { makeWorktreeStatus } from "../scripts/worktree-status.ts";
import { AFTER, alice, ME, ok, prResponse, review, run, thread, comment, type PrSpec } from "./fixtures.ts";
import { cfg, fakeTickDeps, MIN, okJson, tempStore, world, type World } from "./state-helpers.ts";

const STATUSES = { ...DEFAULT_STATUSES, blocked: "status-6", paused: "status-6-2", "needs-attention": "status-7" };
const REPO_ID = "5e166300-ddf1-4dca-b50f-20832c37020d";
const ID = `${REPO_ID}::/w/widgets/feat`;

const config = (over: Partial<Config> = {}): Config => ({ ...cfg({}, true), taskStatuses: STATUSES, ...over });

/** One `orca-ide worktree list --json` row, shaped like Orca's real output. */
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  identity: { key: "wt2:local:aed1a255-2acf-4b3b-b16b-67807321b866", executionHostId: "local", instanceId: "aed1a255-2acf-4b3b-b16b-67807321b866" },
  instanceId: "aed1a255-2acf-4b3b-b16b-67807321b866",
  repoId: REPO_ID,
  projectId: "github:Acme/widgets",
  hostId: "local",
  path: "/w/widgets/feat",
  head: "c0ffee11aabbccddeeff00112233445566778899",
  branch: "refs/heads/feature",
  isBare: false,
  isMainWorktree: false,
  displayName: "feat",
  comment: "finished: opened PR",
  linkedIssue: null,
  linkedPR: 1,
  isArchived: false,
  isUnread: false,
  isPinned: false,
  createdWithAgent: "pi",
  baseRef: "refs/remotes/origin/main",
  workspaceStatus: "in-progress",
  parentWorktreeId: null,
  childWorktreeIds: [],
  lineage: null,
  linkedItems: [],
  ...over,
});

/** The repo's main checkout row. */
const main = (over: Record<string, unknown> = {}) =>
  row({ id: `${REPO_ID}::/w/widgets`, path: "/w/widgets", branch: "refs/heads/main", isMainWorktree: true, linkedPR: null, displayName: "main", workspaceStatus: "todo", ...over });

/** One `orca-ide agent list --json` row, shaped like Orca's real output. */
const agent = (state: string, over: Record<string, unknown> = {}) => ({
  orcaSessionId: "9135ab37-c7bd-4685-ba8b-92a1fb1ce7e6",
  kind: "chat",
  agent: "pi",
  state,
  worktreeId: ID,
  workspace: "feat",
  repo: "widgets",
  hostId: "local",
  paneKey: "structured-agent-session-9135ab37-c7bd-4685-ba8b-92a1fb1ce7e6:7d8a338b-7dd6-4d73-a130-b7b08bc7de24",
  title: "Build the feature",
  lastAssistantMessage: "Working on it.",
  updatedAt: 1795213563712,
  ...over,
});

function columnWorld(pr: PrSpec | null, over: Partial<World> = {}): World {
  return world({ worktrees: [main(), row()], prs: pr ? { "Acme/widgets#1": prResponse(pr) } : {}, ...over });
}

async function runTick(w: World, s: Store, o: { dryRun?: boolean; config?: Config } = {}) {
  const c = o.config ?? config();
  const deps = fakeTickDeps(w);
  const step = makeWorktreeStatus(deps, s, c);
  const out = await tick(deps, s, c, { dryRun: true, worktreeStatusDryRun: o.dryRun ?? false }, { act: async (ctx, r, _i, opts) => step(ctx, r, opts) });
  w.clock += 15 * MIN;
  return out;
}

const writes = (w: World) => w.effects.filter((e) => e.startsWith("worktree-status"));
function snap(s: PrSpec): PrSnapshot {
  const pr = parsePr(JSON.stringify(prResponse(s)), "Acme/widgets", 1, "author", ME);
  assert.ok(pr);
  return pr;
}

describe("worktree column rules", () => {
  it("maps open PRs to Done, Needs Attention, or In Review", () => {
    assert.deepEqual(openPrColumn(snap({})), { state: "done", reason: "PR #1 is ready to merge" });
    assert.equal(openPrColumn(snap({ checks: [ok("a"), run("b", "COMPLETED", "FAILURE")] }))?.state, "needs-attention");
    // A failure counts even while other checks still run.
    assert.equal(openPrColumn(snap({ checks: [run("a", "COMPLETED", "FAILURE"), run("b", "IN_PROGRESS", null)] }))?.reason, "PR #1 has failing checks");
    assert.equal(openPrColumn(snap({ merge: "DIRTY" }))?.reason, "PR #1 has merge conflicts");
    assert.equal(openPrColumn(snap({ decision: "CHANGES_REQUESTED", merge: "BLOCKED" }))?.reason, "PR #1 has changes requested");
    assert.equal(openPrColumn(snap({ threads: [thread(false, comment(alice, AFTER))] }))?.reason, "PR #1 has unanswered review comments");
    assert.deepEqual(openPrColumn(snap({ checks: [run("a", "IN_PROGRESS", null)] })), { state: "in-review", reason: "PR #1 is waiting for checks" });
    assert.deepEqual(openPrColumn(snap({ decision: "REVIEW_REQUIRED", merge: "BLOCKED" })), { state: "in-review", reason: "PR #1 is waiting for review or merge (blocked)" });
    assert.equal(openPrColumn(snap({ merge: "BEHIND" }))?.state, "in-review");
    assert.equal(openPrColumn(snap({ checks: [run("a", "COMPLETED", "CANCELLED")] }))?.state, "in-review");
    // An approval that asks for nothing is not feedback to answer.
    assert.equal(openPrColumn(snap({ reviews: [review(alice, "APPROVED", AFTER, "LGTM")] }))?.state, "done");
    assert.equal(openPrColumn(snap({ isDraft: true })), null);
  });

  it("maps closed PRs and lets a running session win", () => {
    assert.deepEqual(closedPrColumn({ number: 4, state: "MERGED" }), { state: "done", reason: "PR #4 merged" });
    assert.deepEqual(closedPrColumn({ number: 4, state: "CLOSED" }), { state: "needs-attention", reason: "PR #4 closed without merging" });
    assert.deepEqual(worktreeColumn("pi chat working", snap({}), null), { state: "in-progress", reason: "pi chat working" });
    assert.equal(worktreeColumn(null, null, null), null);
    assert.equal(worktreeColumn(null, null, { number: 4, state: "MERGED" })?.state, "done");
  });

  it("matches ignore lists case-insensitively by any repo key", () => {
    assert.equal(isIgnored(["Widgets"], ["acme/widgets", "widgets", "widgets-main"]), true);
    assert.equal(isIgnored(["acme/WIDGETS"], ["acme/widgets"]), true);
    assert.equal(isIgnored(["gadgets"], ["acme/widgets", "widgets", ""]), false);
  });
});

describe("worktree status step", () => {
  it("moves a card to Done when its PR is ready to merge, once, with a worktree-status event", async () => {
    const w = columnWorld({});
    const s = tempStore();
    const out = await runTick(w, s);
    assert.equal(out.exitCode, 0, out.stderr);
    assert.deepEqual(writes(w), [`worktree-status ${ID} completed`]);
    assert.match(out.stdout, /worktree-status Acme\/widgets#1 worktree-status: \/w\/widgets\/feat: in-progress -> done \(PR #1 is ready to merge\)/);
    // Only the status changes: the agent's comment stays.
    assert.equal((w.worktrees[1] as { comment: string }).comment, "finished: opened PR");
    w.effects.length = 0;
    const again = await runTick(w, s);
    assert.deepEqual(writes(w), []);
    assert.doesNotMatch(again.stdout, /worktree-status/);
  });

  it("puts a worktree with a working agent In Progress, over a failing PR", async () => {
    const w = columnWorld({ checks: [run("a", "COMPLETED", "FAILURE")] }, { worktrees: [main(), row({ workspaceStatus: "status-7" })], agents: [agent("working")] });
    const s = tempStore();
    const out = await runTick(w, s);
    assert.deepEqual(writes(w), [`worktree-status ${ID} in-progress`]);
    assert.match(out.stdout, /needs-attention -> in-progress \(pi chat working\)/);
    // The agent finishes: the PR decides again.
    w.agents = [agent("done")];
    w.effects.length = 0;
    const next = await runTick(w, s);
    assert.deepEqual(writes(w), [`worktree-status ${ID} status-7`]);
    assert.match(next.stdout, /in-progress -> needs-attention \(PR #1 has failing checks\)/);
  });

  it("counts an open prflow dispatch on the worktree as running", async () => {
    const w = columnWorld({ decision: "REVIEW_REQUIRED", merge: "BLOCKED" }, { worktrees: [main(), row({ workspaceStatus: "in-review" })] });
    const s = tempStore();
    const d = s.createDispatch("Acme/widgets#1", "v1", "comments", w.clock);
    s.patchDispatch(d.id, { worktree: ID }, w.clock);
    s.transition(d.id, "launched", w.clock, { leaseUntil: w.clock + 600 * MIN });
    const out = await runTick(w, s);
    assert.deepEqual(writes(w), [`worktree-status ${ID} in-progress`]);
    assert.match(out.stdout, new RegExp(`in-review -> in-progress \\(prflow comments dispatch #${d.id} launched\\)`));
  });

  it("moves a worktree whose PR closed unmerged to Needs Attention", async () => {
    const view = "pr view 1 -R acme/widgets --json number,state,title,url,headRefOid";
    const w = columnWorld(null, { refs: { [view]: okJson({ number: 1, state: "CLOSED", title: "x", url: "https://github.com/Acme/widgets/pull/1", headRefOid: "a".repeat(40) }) } });
    const out = await runTick(w, tempStore());
    assert.deepEqual(writes(w), [`worktree-status ${ID} status-7`]);
    assert.match(out.stdout, /in-progress -> needs-attention \(PR #1 closed without merging\)/);
  });

  it("leaves a card alone with no PR, in Blocked or Paused, on a review branch, in the main checkout, or in an ignored or uncovered repo", async () => {
    const cases: [string, World, Config?][] = [
      ["no PR", columnWorld(null, { worktrees: [main(), row({ linkedPR: null, workspaceStatus: "status-7" })] })],
      ["blocked", columnWorld({}, { worktrees: [main(), row({ workspaceStatus: "status-6" })] })],
      ["paused", columnWorld({}, { worktrees: [main(), row({ workspaceStatus: "status-6-2" })], agents: [agent("working")] })],
      ["review", columnWorld({}, { worktrees: [main(), row({ id: `${REPO_ID}::/w/review/prflow-review-widgets-1`, path: "/w/review/prflow-review-widgets-1", branch: "refs/heads/prflow-review/widgets-1" })] })],
      ["main", columnWorld({}, { worktrees: [main({ linkedPR: 1 })], agents: [agent("working", { worktreeId: `${REPO_ID}::/w/widgets` })] })],
      ["ignored by folder", columnWorld({}), config({ worktreeStatus: { dryRun: false, ignore: ["WIDGETS"] } })],
      ["ignored by slug", columnWorld({}), config({ worktreeStatus: { dryRun: false, ignore: ["acme/widgets"] } })],
      ["uncovered", columnWorld({}, { worktrees: [main(), row({ projectId: "github:Other/widgets" })] })],
      ["draft", columnWorld({ isDraft: true })],
    ];
    for (const [name, w, c] of cases) {
      const out = await runTick(w, tempStore(), c ? { config: c } : {});
      assert.equal(out.exitCode, 0, `${name}: ${out.stderr}`);
      assert.deepEqual(writes(w), [], name);
    }
  });

  it("moves nothing when the agent list cannot be read", async () => {
    const w = columnWorld({}, { orcaFails: { agents: "orca not running" } });
    await runTick(w, tempStore());
    assert.deepEqual(writes(w), []);
  });

  it("only announces moves in dry run, once per change", async () => {
    const w = columnWorld({});
    const s = tempStore();
    const out = await runTick(w, s, { dryRun: true });
    assert.deepEqual(writes(w), []);
    assert.match(out.stdout, /dry-run Acme\/widgets#1 worktree-status: would move \/w\/widgets\/feat: in-progress -> done \(PR #1 is ready to merge\)/);
    const again = await runTick(w, s, { dryRun: true });
    assert.doesNotMatch(again.stdout, /would move/);
    // A different target is a new announcement.
    w.agents = [agent("working")];
    w.prs = { "Acme/widgets#1": prResponse({ decision: "REVIEW_REQUIRED", merge: "BLOCKED" }) };
    const busy = await runTick(w, s, { dryRun: true });
    assert.doesNotMatch(busy.stdout, /would move/, "already In Progress");
    w.agents = [];
    const review = await runTick(w, s, { dryRun: true });
    assert.match(review.stdout, /would move \/w\/widgets\/feat: in-progress -> in-review/);
  });

  it("reports a failed write once per target and retries quietly", async () => {
    const w = columnWorld({}, { orcaFails: { worktreeStatus: "worktree not found" } });
    const s = tempStore();
    const out = await runTick(w, s);
    assert.match(out.stdout, /action-failed Acme\/widgets#1 worktree-status: orca-ide worktree set \/w\/widgets\/feat: worktree not found/);
    const again = await runTick(w, s);
    assert.equal(writes(w).length, 2);
    assert.doesNotMatch(again.stdout, /action-failed/);
    delete w.orcaFails.worktreeStatus;
    const fixed = await runTick(w, s);
    assert.match(fixed.stdout, /worktree-status Acme\/widgets#1 worktree-status: .* -> done/);
  });

  it("asks once when a target column has no configured status id", async () => {
    const w = columnWorld({ checks: [run("a", "COMPLETED", "FAILURE")] });
    const s = tempStore();
    const c = config({ taskStatuses: { ...DEFAULT_STATUSES } });
    const out = await runTick(w, s, { config: c });
    assert.deepEqual(writes(w), []);
    assert.match(out.stdout, /needs-decision Acme\/widgets#1 worktree-status: taskStatus\.statuses\.needs-attention is not configured/);
    assert.doesNotMatch((await runTick(w, s, { config: c })).stdout, /needs-decision/);
  });
});

describe("worktree status Orca call", () => {
  it("allows only a status-only set on a non-review worktree id", () => {
    assertOrca(worktreeStatusArgs(ID, "status-7"));
    assert.throws(() => assertOrca(worktreeStatusArgs(`${REPO_ID}::/w/review/prflow-review-widgets-1`, "completed")), /not the allowed worktree status call/);
    assert.throws(() => assertOrca(worktreeStatusArgs(ID, "Bad Status")), /not the allowed worktree status call/);
    assert.throws(() => assertOrca(worktreeStatusArgs(`${REPO_ID}::/w/../etc`, "completed")), /not the allowed worktree status call/);
    assert.throws(() => assertOrca(["worktree", "set", "--worktree", `id:${ID}`, "--workspace-status", "completed", "--force"]), /not the allowed/);
  });
});
