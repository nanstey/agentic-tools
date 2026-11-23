import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { checkState, cleanupBlocker, endDecision, parsePr, parseWorktree, prDecision, skipReason, type Pr, type Worktree } from "../scripts/core.ts";
import { DEFAULT_STATUSES, parseConfig } from "../scripts/config.ts";

const HEAD = "a".repeat(40);
const pr = (over: Partial<Pr> = {}): Pr => ({
  number: 7, state: "OPEN", isDraft: false, mergedAt: null, reviewDecision: "", mergeStateStatus: "CLEAN", headRefOid: HEAD, isCrossRepository: false, headRefName: "feat/x", checks: ["pass"], ...over,
});
const clean = { dirty: false, head: HEAD };
const wt = (over: Partial<Worktree> = {}): Worktree => ({
  id: "r::/w/t", path: "/w/t", branch: "feat/x", isMainWorktree: false, workspaceStatus: "in-progress", comment: "", childWorktreeIds: [], ...over,
});

test("check rollup entries map to pass, fail, cancelled, and pending", () => {
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "SUCCESS" }), "pass");
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "SKIPPED" }), "pass");
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "FAILURE" }), "fail");
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "CANCELLED" }), "cancelled");
  assert.equal(checkState({ __typename: "CheckRun", status: "IN_PROGRESS", conclusion: "" }), "pending");
  assert.equal(checkState({ __typename: "StatusContext", state: "ERROR" }), "fail");
  assert.equal(checkState({ __typename: "StatusContext", state: "PENDING" }), "pending");
});

test("parsePr reads gh pr view JSON", () => {
  const p = parsePr(JSON.stringify({ number: 3, state: "MERGED", isDraft: false, mergedAt: "2026-01-01T00:00:00Z", reviewDecision: null, mergeStateStatus: "UNKNOWN", headRefOid: HEAD, isCrossRepository: false, headRefName: "", statusCheckRollup: [{ __typename: "StatusContext", state: "SUCCESS" }] }));
  assert.deepEqual(p, { number: 3, state: "MERGED", isDraft: false, mergedAt: "2026-01-01T00:00:00Z", reviewDecision: "", mergeStateStatus: "UNKNOWN", headRefOid: HEAD, isCrossRepository: false, headRefName: "", checks: ["pass"] });
  assert.throws(() => parsePr('{"number":1,"state":"WEIRD"}'), /unexpected PR state/);
});

test("PR state maps to the board", () => {
  assert.equal(prDecision(null, clean).state, "needs-attention");
  assert.equal(prDecision(pr(), clean).state, "done");
  assert.equal(prDecision(pr({ reviewDecision: "APPROVED", mergeStateStatus: "HAS_HOOKS" }), clean).state, "done");
  assert.equal(prDecision(pr({ state: "MERGED", mergedAt: "x" }), clean).state, "done");
  assert.equal(prDecision(pr({ checks: ["pass", "pending"] }), clean).state, "in-review");
  assert.equal(prDecision(pr({ reviewDecision: "REVIEW_REQUIRED", mergeStateStatus: "BLOCKED" }), clean).state, "in-review");
  assert.equal(prDecision(pr({ mergeStateStatus: "BEHIND" }), clean).state, "in-review");
  assert.equal(prDecision(pr({ checks: ["fail", "pending"] }), clean).state, "needs-attention");
  assert.equal(prDecision(pr({ reviewDecision: "CHANGES_REQUESTED" }), clean).state, "needs-attention");
  assert.equal(prDecision(pr({ mergeStateStatus: "DIRTY" }), clean).state, "needs-attention");
  assert.equal(prDecision(pr({ isDraft: true }), clean).state, "needs-attention");
  assert.equal(prDecision(pr({ state: "CLOSED" }), clean).state, "needs-attention");
  assert.equal(prDecision(pr(), { dirty: true, head: HEAD }).state, "needs-attention");
  assert.equal(prDecision(pr(), { dirty: false, head: "b".repeat(40) }).state, "needs-attention");
});

test("the agent outcome wins over PR state", () => {
  assert.equal(endDecision("paused", pr(), clean).state, "paused");
  assert.equal(endDecision("blocked", pr(), clean).state, "blocked");
  assert.equal(endDecision("needs-input", pr(), clean).state, "needs-attention");
  assert.equal(endDecision("finished", pr({ checks: ["pending"] }), clean).state, "in-review");
});

test("main checkouts and prflow review worktrees are skipped", () => {
  assert.equal(skipReason(wt()), null);
  assert.match(skipReason(wt({ isMainWorktree: true })) ?? "", /main checkout/);
  assert.match(skipReason(wt({ branch: "prflow-review/acme-7" })) ?? "", /prflow/);
});

test("cleanup requires a merged PR and HEAD at the merged head, but not a clean tree", () => {
  const merged = pr({ state: "MERGED", mergedAt: "2026-01-01T00:00:00Z" });
  assert.equal(cleanupBlocker(wt(), "p", merged, clean), null);
  assert.match(cleanupBlocker(wt(), "p", pr({ state: "MERGED", mergedAt: "x", isCrossRepository: true }), clean) ?? "", /cross-repository/);
  // gh output without the field never counts as same-repository.
  const unknown = parsePr(JSON.stringify({ number: 7, state: "MERGED", mergedAt: "x", headRefOid: HEAD, headRefName: "feat/x", statusCheckRollup: [] }));
  assert.match(cleanupBlocker(wt(), "p", unknown, clean) ?? "", /cross-repository/);
  assert.match(cleanupBlocker(wt(), "p", pr({ state: "MERGED", mergedAt: "x", headRefName: "same-name" }), clean) ?? "", /does not match local branch/);
  assert.match(cleanupBlocker(wt(), "p", null, clean) ?? "", /no PR/);
  assert.match(cleanupBlocker(wt(), "p", pr(), clean) ?? "", /not merged/);
  assert.match(cleanupBlocker(wt(), "p", pr({ state: "MERGED" }), clean) ?? "", /not merged/);
  assert.equal(cleanupBlocker(wt(), "p", merged, { dirty: true, head: HEAD }), null);
  assert.match(cleanupBlocker(wt(), "p", merged, { dirty: false, head: "b".repeat(40) }) ?? "", /not in merged PR/);
  assert.match(cleanupBlocker(wt({ workspaceStatus: "p" }), "p", merged, clean) ?? "", /paused/);
  assert.match(cleanupBlocker(wt(), undefined, merged, clean) ?? "", /Paused status id is not configured/);
  assert.match(cleanupBlocker(wt({ childWorktreeIds: ["c"] }), "p", merged, clean) ?? "", /child/);
  assert.match(cleanupBlocker(wt({ isMainWorktree: true }), "p", merged, clean) ?? "", /main checkout/);
});

test("parseWorktree validates orca worktree current output", () => {
  const w = parseWorktree(JSON.stringify({ ok: true, result: { worktree: { id: "r::/p", path: "/p", branch: "refs/heads/feat/x", isMainWorktree: false, workspaceStatus: "todo", childWorktreeIds: [] } } }));
  assert.equal(w.branch, "feat/x");
  assert.throws(() => parseWorktree('{"ok":true,"result":{"worktree":{"id":"r::/p"}}}'), /isMainWorktree/);
  assert.throws(() => parseWorktree('{"ok":false}'), /no worktree/);
});

test("config maps states to Orca status ids over the built-in defaults", () => {
  const cfg = parseConfig('{"taskStatus":{"statuses":{"paused":"status-6-2","needs-attention":"status-7"}}}', "c");
  assert.deepEqual(cfg.statuses, { ...DEFAULT_STATUSES, paused: "status-6-2", "needs-attention": "status-7" });
  assert.throws(() => parseConfig('{"taskStatus":{"statuses":{"todo":"x"}}}', "c"), /unknown state/);
  assert.throws(() => parseConfig('{"taskStatus":{"other":1}}', "c"), /taskStatus\.unknown key "other"/);
  assert.deepEqual(parseConfig('{"prflow":{"limit":1},"futureTool":true,"taskStatus":{"statuses":{"done":"d"}}}', "c").statuses.done, "d");
  assert.throws(() => parseConfig('{"taskStatus":{"statuses":{"done":""}}}', "c"), /non-empty/);
});

test("config accepts the shipped config.example.json, including the orchestrator section", () => {
  const text = readFileSync(join(import.meta.dirname, "../../../../config.example.json"), "utf8");
  assert.ok("orchestrator" in JSON.parse(text));
  assert.equal(parseConfig(text, "config.example.json").statuses["needs-attention"], "status-7");
});
