import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rerequest } from "../scripts/phases/07-threads.ts";
import type { Snapshot } from "../scripts/core/resolve.ts";
import type { CommandRunner } from "../scripts/core/runner.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-rerequest-state-"));
const oldStateHome = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = stateHome;
after(() => { if (oldStateHome === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldStateHome; rmSync(stateHome, { recursive: true, force: true }); });
const head = "a".repeat(40);
const base = "b".repeat(40);
const pr = { repo: "acme/repo", number: 7, author: "pr-author", headRefOid: head, baseRefOid: base } as Snapshot;
const review = (login: string, commit = head) => ({ user: { login, type: "User" }, state: "COMMENTED", submitted_at: "2025-01-01T00:00:00Z", commit_id: commit });
const comment = (login: string, at: string, type = "User") => ({ author: { login, __typename: type }, createdAt: at });
const thread = (resolved: boolean, comments: unknown[]) => ({ id: "thread-1", isResolved: resolved, isOutdated: false, comments: { nodes: comments, pageInfo: { hasNextPage: false } } });

function snapshotPayload() {
  const prData = { title: "Feature", url: "https://github.com/acme/repo/pull/7", state: "OPEN", isDraft: false, headRefOid: head, headRefName: "topic", mergeStateStatus: "CLEAN", reviewDecision: null,
    commits: { nodes: [{ commit: { oid: head, committedDate: "2025-01-01", statusCheckRollup: { contexts: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } }] },
    recentCommits: { nodes: [{ commit: { oid: head } }] }, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviewRequests: { nodes: [] } };
  return JSON.stringify({ data: { repository: { pullRequest: prData } } });
}
function fixture(options: { reviews?: unknown[]; users?: string[]; threads?: unknown[]; fail?: string } = {}) {
  const writes: string[][] = [];
  const requested = new Set(options.users ?? []);
  const runner: CommandRunner = async (_command, args) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: process.cwd(), stderr: "" };
    const joined = args.join(" ");
    if (options.fail && joined.includes(options.fail)) return { ok: false, stdout: "", stderr: "API unavailable" };
    if (joined.includes("pulls/7/reviews?per_page=100")) return { ok: true, stdout: JSON.stringify([options.reviews ?? [review("reviewer")]]), stderr: "" };
    if (args.includes("-X") && args.includes("POST")) { writes.push(args); const login = args.find((arg) => arg.startsWith("reviewers[]="))?.split("=")[1]; if (login) requested.add(login); return { ok: true, stdout: "{}", stderr: "" }; }
    if (joined.includes("pulls/7/requested_reviewers")) return { ok: true, stdout: JSON.stringify({ users: [...requested].map((login) => ({ login })) }), stderr: "" };
    if (args[0] === "api" && args[1] === "graphql" && joined.includes("recentCommits")) return { ok: true, stdout: snapshotPayload(), stderr: "" };
    if (args[0] === "api" && args[1] === "graphql") return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: options.threads ?? [], pageInfo: { hasNextPage: false, endCursor: null } } } } } }), stderr: "" };
    if (args[0] === "pr" && args[1] === "view" && args.includes("number,url")) return { ok: true, stdout: JSON.stringify({ number: 7, url: "https://github.com/acme/repo/pull/7" }), stderr: "" };
    if (args[0] === "api" && args[1] === "user") return { ok: true, stdout: '"pr-author"', stderr: "" };
    if (args[0] === "pr" && args[1] === "view") return { ok: true, stdout: JSON.stringify({ author: { login: "pr-author" }, headRefName: "topic", headRefOid: head, baseRefName: "main", baseRefOid: base, isCrossRepository: false, isDraft: false, state: "OPEN", url: "https://github.com/acme/repo/pull/7", title: "Feature" }), stderr: "" };
    if (joined.includes("pulls/7")) return { ok: true, stdout: JSON.stringify({}), stderr: "" };
    return { ok: true, stdout: "", stderr: "" };
  };
  return { runner, writes };
}

test("rerequest accepts reviewer when all started threads are resolved or author-replied, and dry-run writes nothing", async () => {
  const { runner, writes } = fixture({ reviews: [review("resolved-reviewer"), review("replied-reviewer")], threads: [thread(true, [comment("resolved-reviewer", "2025-01-01")]), thread(false, [comment("replied-reviewer", "2025-01-01"), comment("pr-author", "2025-01-02")])] });
  const result = await rerequest(pr, runner, true) as { requested: string[] };
  assert.deepEqual(result.requested, ["resolved-reviewer", "replied-reviewer"]);
  assert.deepEqual(writes, []);
});

test("rerequest submits and verifies an eligible reviewer", async () => {
  const { runner, writes } = fixture({ reviews: [review("reviewer", "c".repeat(40))], threads: [thread(false, [comment("reviewer", "2025-01-01")])] });
  const result = await rerequest(pr, runner, false) as { requested: string[] };
  assert.deepEqual(result.requested, ["reviewer"]);
  assert.equal(writes.length, 1);
});

test("rerequest remains blocked for unresolved feedback without author reply or newer commit", async () => {
  const { runner, writes } = fixture({ reviews: [review("reviewer")], threads: [thread(false, [comment("reviewer", "2025-01-01")])] });
  const result = await rerequest(pr, runner, true) as { requested: string[] };
  assert.deepEqual(result.requested, []);
  assert.deepEqual(writes, []);
});

test("rerequest propagates review API failures as blocked", async () => {
  const { runner } = fixture({ fail: "pulls/7/reviews?per_page=100" });
  await assert.rejects(() => rerequest(pr, runner, true), /blocked: gh API/);
});

test("rerequest excludes author, bots, and already requested users", async () => {
  const { runner } = fixture({ reviews: [review("pr-author"), { ...review("automation[bot]"), user: { login: "automation[bot]", type: "Bot" } }, review("requested")], users: ["requested"] });
  const result = await rerequest(pr, runner, true) as { requested: string[] };
  assert.deepEqual(result.requested, []);
});

test("rerequest accepts newer commit even while reviewer thread remains unresolved", async () => {
  const { runner } = fixture({ reviews: [review("reviewer", "c".repeat(40))], threads: [thread(false, [comment("reviewer", "2025-01-01")])] });
  const result = await rerequest(pr, runner, true) as { requested: string[] };
  assert.deepEqual(result.requested, ["reviewer"]);
});
