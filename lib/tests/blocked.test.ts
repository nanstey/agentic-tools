import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import {
  blockedComment, blockedStatePath, clearBlocked, evaluate, formatCondition, isBlockedComment, parseBlockedFile, parseCondition, parseConditions,
  parseReason, putBlocked, readBlocked, type BlockedRecord, type Facts, type OwnPrFacts, waitsOnlyOnCi } from "../blocked.ts";

const dirs: string[] = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

test("conditions parse from --until values and format back", () => {
  assert.deepEqual(parseCondition("checks-pass"), { kind: "checks-pass" });
  assert.deepEqual(parseCondition(" pr-approved "), { kind: "pr-approved" });
  assert.deepEqual(parseCondition("manual"), { kind: "manual" });
  assert.deepEqual(parseCondition("pr-merged acme/api#3"), { kind: "pr-merged", repo: "acme/api", number: 3 });
  assert.deepEqual(parseCondition("pr-merged=acme/api#3"), { kind: "pr-merged", repo: "acme/api", number: 3 });
  assert.equal(formatCondition(parseCondition("pr-merged=acme/api#3")), "pr-merged acme/api#3");
  for (const bad of ["", "soon", "checks-pass now", "pr-merged", "pr-merged acme#3", "pr-merged acme/api#0", "pr-merged acme/api#3 x", "pr-review acme/api#3"])
    assert.throws(() => parseCondition(bad), /condition/, bad);
});

test("condition lists need one entry, drop duplicates, and keep manual alone", () => {
  assert.throws(() => parseConditions([]), /at least one --until/);
  assert.deepEqual(parseConditions(["checks-pass", "checks-pass", "pr-approved"]).map(formatCondition), ["checks-pass", "pr-approved"]);
  assert.throws(() => parseConditions(["manual", "checks-pass"]), /manual cannot be combined/);
  assert.deepEqual(parseConditions(["manual", "manual"]), [{ kind: "manual" }]);
});

test("reasons are one trimmed line and the comment names them", () => {
  assert.equal(parseReason("  waiting on api  "), "waiting on api");
  assert.throws(() => parseReason(undefined), /--reason is required/);
  assert.throws(() => parseReason("a\nb"), /one line/);
  assert.throws(() => parseReason("x".repeat(161)), /at most 160/);
  const c = blockedComment("waiting on api", parseConditions(["pr-merged acme/api#3", "checks-pass"]));
  assert.equal(c, "Blocked: waiting on api · until: pr-merged acme/api#3, checks-pass");
  assert.equal(isBlockedComment(c), true);
  assert.equal(isBlockedComment("note"), false);
});

const rec = (over: Partial<BlockedRecord> = {}): BlockedRecord => ({
  worktreeId: "r::/w/a", path: "/w/a", branch: "feat/a", repo: "acme/x", pr: 1, reason: "dep", conditions: ["checks-pass"], setAt: "2026-01-01T00:00:00.000Z", ...over,
});

test("records persist in one shared file keyed by worktree id", () => {
  const dir = mkdtempSync(join(tmpdir(), "blocked-test-"));
  dirs.push(dir);
  const path = blockedStatePath({ XDG_STATE_HOME: dir });
  assert.equal(path, join(dir, "agentic-tools", "blocked.json"));
  assert.deepEqual(readBlocked(path).records, {});
  assert.equal(clearBlocked(path, "r::/w/a"), false);
  putBlocked(path, rec());
  putBlocked(path, rec({ worktreeId: "r::/w/b", path: "/w/b" }));
  assert.deepEqual(Object.keys(readBlocked(path).records).sort(), ["r::/w/a", "r::/w/b"]);
  // A clear pinned to an older setAt leaves a newer record alone.
  assert.equal(clearBlocked(path, "r::/w/a", "2025-01-01T00:00:00.000Z"), false);
  assert.equal(clearBlocked(path, "r::/w/a", "2026-01-01T00:00:00.000Z"), true);
  assert.deepEqual(Object.keys(readBlocked(path).records), ["r::/w/b"]);
  assert.equal(blockedStatePath({}, "/home/t"), "/home/t/.local/state/agentic-tools/blocked.json");
});

test("invalid records are dropped when read", () => {
  const f = parseBlockedFile(JSON.stringify({ version: 1, records: { "r::/w/a": rec(), "r::/w/b": rec({ conditions: ["soon"] }), "r::/w/c": rec() } }));
  assert.deepEqual(Object.keys(f.records), ["r::/w/a"]);
  const dir = mkdtempSync(join(tmpdir(), "blocked-test-"));
  dirs.push(dir);
  writeFileSync(join(dir, "blocked.json"), "{");
  assert.throws(() => readBlocked(join(dir, "blocked.json")));
});

const own = (over: Partial<OwnPrFacts> = {}): OwnPrFacts => ({
  number: 1, state: "OPEN", headSha: "1a2b3c4d5e6f", reviewDecision: "REVIEW_REQUIRED", checks: ["pass"], required: [], ...over,
});
const facts = (pr: OwnPrFacts | null, others: Record<string, string> = {}): Facts => ({ pr, others });
const ev = (conds: string[], f: Facts) => evaluate(parseConditions(conds), f);

test("checks-pass holds when no required check is pending or failing", () => {
  const dep = (pr: OwnPrFacts | null) => ev(["pr-merged acme/api#3", "checks-pass"], facts(pr, { "acme/api#3": "MERGED" }));
  assert.deepEqual(dep(own()), { holds: true, met: ["acme/api#3 merged", "checks passed at 1a2b3c4d"], unmet: [], stuck: null });
  // Required checks decide; an optional failure does not block.
  assert.equal(dep(own({ checks: ["pass", "fail"], required: ["pass"] })).holds, true);
  assert.deepEqual(dep(own({ checks: ["pending"], required: ["pending"] })).unmet, ["PR #1 has pending required checks"]);
  // With no required checks, every check counts.
  assert.deepEqual(dep(own({ checks: ["pass", "fail"] })).unmet, ["PR #1 has failing checks"]);
  assert.deepEqual(dep(null).unmet, ["checks-pass: no PR for this branch"]);
  assert.equal(dep(own({ state: "CLOSED" })).stuck, "PR #1 closed without merging");
});

test("waiting only for CI is In Review, not Blocked: checks-pass alone always holds on an open PR", () => {
  assert.equal(waitsOnlyOnCi(parseConditions(["checks-pass"])), true);
  assert.equal(waitsOnlyOnCi(parseConditions(["checks-pass", "pr-approved"])), false);
  assert.equal(waitsOnlyOnCi(parseConditions(["manual"])), false);
  assert.deepEqual(ev(["checks-pass"], facts(own())), { holds: true, met: ["checks passed at 1a2b3c4d"], unmet: [], stuck: null });
  assert.deepEqual(ev(["checks-pass"], facts(own({ checks: ["pending"], required: ["pending"] }))).met, ["PR #1 checks pending; waiting for CI is In Review, not Blocked"]);
  assert.deepEqual(ev(["checks-pass"], facts(own({ checks: ["fail"] }))).met, ["PR #1 checks failing; waiting for CI is In Review, not Blocked"]);
  assert.deepEqual(ev(["checks-pass"], facts(own({ checks: ["cancelled"] }))).met, ["PR #1 checks cancelled; waiting for CI is In Review, not Blocked"]);
  // With another condition, cancelled checks do not pass checks-pass.
  assert.deepEqual(ev(["checks-pass", "pr-approved"], facts(own({ checks: ["cancelled"], reviewDecision: "APPROVED" }))).unmet, ["PR #1 has cancelled checks"]);
  assert.equal(ev(["checks-pass"], facts(null)).holds, false);
  assert.equal(ev(["checks-pass"], facts(own({ state: "CLOSED" }))).stuck, "PR #1 closed without merging");
});

test("pr-approved holds only on APPROVED", () => {
  assert.deepEqual(ev(["pr-approved"], facts(own({ reviewDecision: "APPROVED" }))).met, ["PR #1 approved"]);
  assert.deepEqual(ev(["pr-approved"], facts(own())).unmet, ["PR #1 is not approved (review_required)"]);
  assert.equal(ev(["pr-approved"], facts(own({ reviewDecision: "" }))).holds, false);
});

test("pr-merged holds when the other PR merged and is stuck when it closed unmerged", () => {
  assert.deepEqual(ev(["pr-merged acme/api#3"], facts(null, { "acme/api#3": "MERGED" })), { holds: true, met: ["acme/api#3 merged"], unmet: [], stuck: null });
  assert.deepEqual(ev(["pr-merged Acme/API#3"], facts(null, { "acme/api#3": "OPEN" })).unmet, ["Acme/API#3 is open"]);
  assert.equal(ev(["pr-merged acme/api#3"], facts(null, { "acme/api#3": "CLOSED" })).stuck, "acme/api#3 closed without merging");
  assert.deepEqual(ev(["pr-merged acme/api#3"], facts(null)).unmet, ["acme/api#3 is unknown"]);
});

test("every condition must hold, and manual never does", () => {
  const f = facts(own(), { "acme/api#3": "MERGED" });
  assert.deepEqual(ev(["pr-merged acme/api#3", "checks-pass"], f).met, ["acme/api#3 merged", "checks passed at 1a2b3c4d"]);
  assert.equal(ev(["pr-merged acme/api#3", "pr-approved"], f).holds, false);
  assert.deepEqual(ev(["manual"], f), { holds: false, met: [], unmet: ["manual: only a person unblocks it"], stuck: null });
});
