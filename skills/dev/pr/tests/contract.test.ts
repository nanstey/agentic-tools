import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dispatchCli, execute, type CommandRunner, type Clock } from "../scripts/pr.ts";
import { cleanup, merge, squashSubject } from "../scripts/merge.ts";
import { startRun, changeRun, identityOf, statePath } from "../scripts/run.ts";
import { readPrStore } from "../../../../lib/pr/store.ts";
import { inventory, rerunCancelled, waitChecks } from "../scripts/checks.ts";
import { updateBody } from "../scripts/body.ts";
import { push, draft } from "../scripts/guard.ts";
import type { Snapshot } from "../scripts/resolve.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-contract-state-"));
const previousStateHome = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = stateHome;
after(() => { if (previousStateHome === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previousStateHome; rmSync(stateHome, { recursive: true, force: true }); });

const head = "a".repeat(40), base = "b".repeat(40);
function fixture(options: { pending?: boolean; neutral?: boolean; fail?: RegExp; merged?: boolean; body?: string } = {}) {
  const calls: string[][] = [];
  let body = options.body ?? "";
  const runner: CommandRunner = async (command, args) => {
    calls.push([command, ...args]);
    const joined = args.join(" ");
    if (options.fail?.test(joined)) return { ok: false, stdout: "", stderr: "HTTP 403 rate limit or auth failure" };
    if (command === "git") {
      if (args[0] === "rev-parse") return { ok: true, stdout: "/repo/.git\n", stderr: "" };
      if (args[0] === "rev-list") return { ok: true, stdout: "0\n", stderr: "" };
      if (args[0] === "status") return { ok: true, stdout: "", stderr: "" };
      return { ok: true, stdout: "", stderr: "" };
    }
    if (command !== "gh") return { ok: true, stdout: "", stderr: "" };
    if (args[0] === "pr" && args[1] === "view" && args.at(-1) === "body") return { ok: true, stdout: JSON.stringify({ body }), stderr: "" };
    if (args[0] === "pr" && args[1] === "view" && args.includes("number,url")) return { ok: true, stdout: JSON.stringify({ number: 7, url: "https://github.com/acme/repo/pull/7" }), stderr: "" };
    if (args[0] === "pr" && args[1] === "view") return { ok: true, stdout: JSON.stringify({ author: { login: "me" }, headRefName: "topic", headRefOid: head, baseRefName: "main", baseRefOid: base, isCrossRepository: false, isDraft: false, state: options.merged && joined.includes("state") ? "MERGED" : "OPEN", url: "https://github.com/acme/repo/pull/7", title: "Feature (#7)", body }), stderr: "" };
    if (args[0] === "api" && args[1] === "user") return { ok: true, stdout: "me", stderr: "" };
    if (args[0] === "api" && args[1] === "graphql") {
      const context = options.pending ? [{ __typename: "StatusContext", context: "ci", state: "PENDING" }] : [{ __typename: "StatusContext", context: "ci", state: options.neutral ? "NEUTRAL" : "SUCCESS" }];
      const pr = { title: "Feature (#7)", url: "https://github.com/acme/repo/pull/7", state: options.merged ? "MERGED" : "OPEN", isDraft: false, headRefOid: head, headRefName: "topic", baseRefOid: base, baseRefName: "main", mergeStateStatus: "CLEAN", reviewDecision: null, commits: { nodes: [{ commit: { oid: head, committedDate: "2025-01-01T00:00:00Z", statusCheckRollup: { contexts: { nodes: context, pageInfo: { hasNextPage: false, endCursor: null } } } } }] }, recentCommits: { nodes: [{ commit: { oid: head } }] }, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviewRequests: { nodes: [] } };
      return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: pr } } }), stderr: "" };
    }
    if (args[0] === "api" && args.join(" ").includes("pulls/7")) {
      if (args.includes("PATCH")) { const file = args.find((arg) => arg.startsWith("body=@"))?.slice(6); if (file) body = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8")); return { ok: true, stdout: "", stderr: "" }; }
      return { ok: true, stdout: JSON.stringify({ stack: null }), stderr: "" };
    }
    if (args[0] === "api" && args.join(" ").includes("requested_reviewers")) return { ok: true, stdout: JSON.stringify({ users: [] }), stderr: "" };
    if (args[0] === "api" && args[1] === "graphql") return { ok: true, stdout: "{}", stderr: "" };
    if (args[0] === "api" && args[1] === "repos/acme/repo") return { ok: true, stdout: "[]", stderr: "" };
    if (args[0] === "pr" && args[1] === "edit") { const file = args[args.indexOf("--body-file") + 1]!; body = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8")); return { ok: false, stdout: "", stderr: "projectCards unavailable" }; }
    return { ok: true, stdout: "", stderr: "" };
  };
  return { runner, calls };
}
const clock: Clock = { now: () => Date.now(), sleep: async () => {} };
const pr = (checks: Snapshot["checks"] = []): Snapshot => ({ repo: "acme/repo", owner: "own", number: 7, url: "https://github.com/acme/repo/pull/7", title: "Feature (#7)", body: "", state: "OPEN", isDraft: false, headRefName: "topic", headRefOid: head, baseRefName: "main", baseRefOid: base, mergeStateStatus: "CLEAN", reviewDecision: null, author: "me", isCrossRepository: false, checks, comments: [], reviews: [], threads: [], stack: null } as unknown as Snapshot);

test("A5 dispatcher success and failure streams are one-object or nonzero blocked contracts", async () => {
  const ok = await dispatchCli(["authorize", "review", "--owner", "other"], async () => { throw new Error("API must not run"); });
  assert.equal(ok.exitCode, 0); assert.equal(ok.stderr, ""); assert.equal(ok.stdout.trim().split("\n").length, 1); assert.equal(typeof JSON.parse(ok.stdout).allowed, "object");
  const blocked = await dispatchCli(["authorize"], async () => { throw new Error("API must not run"); });
  assert.notEqual(blocked.exitCode, 0); assert.match(blocked.stderr, /^blocked: .+ — .+; unblock requires: .+\n$/); assert.equal(blocked.stdout, "");
  const failed = await dispatchCli(["snapshot", "7"], async () => ({ ok: false, stdout: "", stderr: "HTTP 401 rate limit/auth failure" }));
  assert.notEqual(failed.exitCode, 0); assert.match(failed.stderr, /^blocked: .+ — .+; unblock requires: .+\n$/); assert.equal(failed.stdout, "");
  // authorize and disclosure perform no API call, so their API-failure case is N/A.
});

test("merge, review post, and push reject run actions not authorized for the PR owner", async () => {
  for (const [command, args] of [["merge", ["--required", "ci"]], ["review", ["post", "7", "--event", "COMMENT", "--body-file", "unused"]], ["push", []]] as const) {
    const run = startRun(pr(), "info", null, false, clock); const { runner, calls } = fixture();
    const invocation = command === "review" ? [command, ...args] : [command, "7", ...args];
    const result = await dispatchCli([...invocation, "--run", run.id], runner, clock);
    assert.notEqual(result.exitCode, 0, command); assert.match(result.stderr, /blocked: authorization/);
    assert.equal(calls.some((call) => call[1] === "merge" || call[1] === "push" || call.includes("POST")), false, command);
  }
});

test("no-required-checks needs a policy reason and records the proof on the run", async () => {
  const { runner } = fixture(); const run = startRun(pr(), "merge", null, false, clock);
  await assert.rejects(() => merge(pr(), run.id, false, [], runner, clock, true), /blocked: required checks/);
  const result = await dispatchCli(["merge", "7", "--run", run.id, "--no-required-checks", "--policy-proof", "trusted policy has no required jobs"], runner, clock);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(readPrStore(statePath(pr()), identityOf(pr())).runs[run.id]?.policyProof, "trusted policy has no required jobs");
});

test("merge parses run and policy flags without mistaking them for a target", async () => {
  const { runner, calls } = fixture();
  const started = await execute(["run", "start", "--pr", "7", "--action", "merge"], runner) as { run: { id: string } };
  const result = await dispatchCli(["merge", "--run", started.run.id, "--no-required-checks", "--policy-proof", "T"], runner, clock);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(readPrStore(statePath(pr()), identityOf(pr())).runs[started.run.id]?.policyProof, "T");
  assert.ok(calls.some((args) => args.some((arg) => arg.endsWith("/pulls/7"))));
  assert.ok(!calls.some((args) => args[0] === "gh" && args[1] === "pr" && args.includes("T")));
});
test("A10 pending checks time out after 30 minutes without merge; force snapshots once and merges", async () => {
  const pending = fixture({ pending: true }); let now = 0, snapshots = 0;
  const fakeClock: Clock = { now: () => now, sleep: async (ms) => { now += ms; } };
  const waitRunner: CommandRunner = async (command, args, env, cwd, timeout) => { if (command === "gh" && args[0] === "api" && args[1] === "graphql") snapshots++; return pending.runner(command, args, env, cwd, timeout); };
  const pendingRun = startRun(pr(), "merge", null, false, fakeClock);
  const blocked = await merge(pr([{ name: "ci", typename: "StatusContext", state: "PENDING", isRequired: true, url: null }]), pendingRun.id, false, ["ci"], waitRunner, fakeClock);
  assert.deepEqual(blocked, { status: "pending", checks: ["ci"] }); assert.equal(now, 30 * 60_000); assert.equal(pending.calls.some((call) => call.includes("merge")), false);
  const forced = fixture({ pending: true }); snapshots = 0;
  const forceResult = await waitChecks(pr([{ name: "ci", typename: "StatusContext", state: "PENDING", isRequired: true, url: null }]), ["ci"], 30 * 60_000, true, async (command, args, env, cwd, timeout) => { if (command === "gh" && args[0] === "api" && args[1] === "graphql") snapshots++; return forced.runner(command, args, env, cwd, timeout); }, clock);
  assert.equal(snapshots, 1); assert.deepEqual(forceResult, { status: "overridden", overridden: ["ci"] });
  const mergeRun = startRun(pr(), "merge", null, true, clock);
  await merge(pr([{ name: "ci", typename: "StatusContext", state: "PENDING", isRequired: true, url: null }]), mergeRun.id, true, ["ci"], forced.runner, clock);
  assert.equal(forced.calls.some((call) => call.includes("--squash")), true);
  const mergeArgs = forced.calls.find((call) => call.includes("--squash")) ?? [];
  assert.ok(mergeArgs.includes("--body") && mergeArgs[mergeArgs.indexOf("--body") + 1] === "");
  assert.ok(mergeArgs.includes("--match-head-commit") && mergeArgs.includes(head));
});

test("check inventory accepts unprotected branches and reruns cancelled Actions jobs by job id", async () => {
  const calls: string[][] = [];
  const runner: CommandRunner = async (command, args) => {
    calls.push(args);
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: process.cwd(), stderr: "" };
    if (args[1]?.includes("/branches/")) return { ok: false, stdout: "", stderr: "HTTP 404 Not Found" };
    if (args[1]?.includes("/actions/runs/99/jobs")) return { ok: true, stdout: JSON.stringify({ jobs: [{ id: 123, name: "ci" }] }), stderr: "" };
    if (args[1]?.includes("/rulesets")) return { ok: true, stdout: "[]", stderr: "" };
    if (args[1]?.includes("/workflows")) return { ok: true, stdout: "[]", stderr: "" };
    return { ok: true, stdout: "", stderr: "" };
  };
  await inventory(pr(), runner);
  assert.ok(calls.some((args) => args[1]?.includes("/workflows") && args.includes("--paginate")));
  const cancelled = { ...pr(), checks: [{ name: "ci", typename: "CheckRun", status: "COMPLETED", conclusion: "CANCELLED", isRequired: true, url: "https://github.com/acme/repo/actions/runs/99" }] } as unknown as Snapshot;
  await rerunCancelled(cancelled, "run-id", runner);
  const rerun = calls.find((args) => args[0] === "run" && args[1] === "rerun") ?? [];
  assert.ok(rerun.includes("--job") && rerun[rerun.indexOf("--job") + 1] === "123");
  assert.ok(!rerun.includes("--failed"));
});

test("a cancelled required check fails immediately without polling", async () => {
  const baseRunner = fixture().runner; let sleeps = 0;
  const runner: CommandRunner = async (command, args, env, cwd, timeout) => {
    const result = await baseRunner(command, args, env, cwd, timeout);
    if (command === "gh" && args[0] === "api" && args[1] === "graphql" && result.ok) {
      const data = JSON.parse(result.stdout) as any;
      data.data.repository.pullRequest.commits.nodes[0]!.commit.statusCheckRollup.contexts.nodes[0] = { __typename: "CheckRun", status: "COMPLETED", conclusion: "CANCELLED", name: "ci" };
      return { ...result, stdout: JSON.stringify(data) };
    }
    return result;
  };
  const result = await waitChecks(pr(), ["ci"], 30 * 60_000, false, runner, { now: () => 0, sleep: async () => { sleeps++; } });
  assert.deepEqual(result, { status: "failed", checks: ["ci"] });
  assert.equal(sleeps, 0);
});

test("checks wait preserves the PR target before a multi-name required list", async () => {
  const baseRunner = fixture().runner; const views: string[][] = [];
  const runner: CommandRunner = async (command, args, env, cwd, timeout) => { if (command === "gh" && args[0] === "pr" && args[1] === "view") views.push(args); return baseRunner(command, args, env, cwd, timeout); };
  const result = await dispatchCli(["checks", "wait", "7", "--required", "ci", "lint", "--force"], runner, clock);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { status: "overridden", overridden: ["lint"] });
  assert.ok(views.some((args) => args[2] === "7"));
});

test("required checks need an explicit list and skipped or neutral checks need policy proof", async () => {
  const zero = await waitChecks(pr(), [], 0, false, fixture().runner, clock);
  assert.deepEqual(zero, { status: "needs_policy_proof", needs_policy_proof: ["no required checks supplied"] });
  const neutral = await waitChecks(pr(), ["ci"], 0, false, fixture({ neutral: true }).runner, clock);
  assert.deepEqual(neutral, { status: "needs_policy_proof", needs_policy_proof: ["ci"] });
});

test("force retries a branch-protection rejection with --admin only for an admin viewer", async () => {
  const baseRunner = fixture({ merged: true }).runner; const calls: string[][] = []; let firstMerge = true;
  const runner: CommandRunner = async (command, args, env, cwd, timeout) => {
    calls.push([command, ...args]);
    if (command === "gh" && args[0] === "pr" && args[1] === "merge" && firstMerge) { firstMerge = false; return { ok: false, stdout: "", stderr: "branch protection requires admin" }; }
    if (command === "gh" && args[0] === "repo" && args.includes("viewerPermission")) return { ok: true, stdout: JSON.stringify({ viewerPermission: "ADMIN" }), stderr: "" };
    return baseRunner(command, args, env, cwd, timeout);
  };
  const runId = startRun(pr(), "merge", null, true, { now: () => Date.now(), sleep: async () => {} }).id;
  await merge(pr(), runId, true, ["ci"], runner, clock);
  const adminMerge = calls.find((args) => args.includes("--admin"));
  assert.ok(adminMerge);
  assert.equal(adminMerge?.[adminMerge.indexOf("--body") + 1], "");
  assert.ok(adminMerge?.includes("--match-head-commit"));
});

test("A11 squash subject is unique and queued merge remains unmerged so cleanup refuses", async () => {
  assert.equal(squashSubject("Feature (#7)", 7), "Feature (#7)"); assert.equal(squashSubject("Feature", 7), "Feature (#7)");
  const queued = fixture(); const runId = startRun(pr(), "merge", null, false, clock).id;
  const result = await merge(pr(), runId, false, ["ci"], queued.runner, clock);
  assert.equal((result as { status: string }).status, "queued");
  const cleanupResult = await dispatchCli(["cleanup", "7", "--run", runId], queued.runner, clock);
  assert.notEqual(cleanupResult.exitCode, 0);
});

test("A12 cleanup returns all five outcomes and only removes captured id selector", async () => {
  const run = async (responses: Record<string, { ok: boolean; stdout: string; stderr: string }>, calls: string[][]) => cleanup(pr(), async (command, args) => { calls.push([command, ...args]); const key = args.join(" "); return responses[key] ?? { ok: true, stdout: command === "git" && args[0] === "status" ? "" : command === "git" && args[1] === "--git-dir" ? "/repo/.git\n" : command === "git" ? "/common/.git\n" : "", stderr: "" }; });
  const primary = await cleanup(pr(), async (_c, a) => ({ ok: true, stdout: a[0] === "status" ? "" : "/same", stderr: "" })); assert.deepEqual(primary, { cleanup: "primary" });
  const mk = (mode: string, calls: string[][]) => async (command: string, args: string[]) => { calls.push([command, ...args]); if (command === "git") return { ok: true, stdout: args[0] === "status" ? "" : args.at(-1) === "--git-dir" ? "/repo/.git" : "/common/.git", stderr: "" }; if (args[0] === "--version") return mode === "unavailable" ? { ok: false, stdout: "", stderr: "missing" } : { ok: true, stdout: "orca", stderr: "" }; if (args[0] === "worktree" && args[1] === "current") return mode === "outside" ? { ok: false, stdout: "selector_not_found", stderr: "" } : { ok: true, stdout: JSON.stringify({ result: { worktree: { id: "captured-42", isMainWorktree: false } } }), stderr: "" }; return mode === "remove-fail" ? { ok: false, stdout: "", stderr: "conflict" } : { ok: true, stdout: "{}", stderr: "" }; };
  const unavailable = await cleanup(pr(), mk("unavailable", [])); assert.deepEqual(unavailable, { cleanup: "skipped (Orca unavailable)" });
  const outside = await cleanup(pr(), mk("outside", [])); assert.deepEqual(outside, { cleanup: "skipped (outside Orca)" });
  const mainConflict = await cleanup(pr(), async (command, args) => {
    if (command === "git") return { ok: true, stdout: args[0] === "status" ? "" : args.at(-1) === "--git-dir" ? "/repo/.git" : "/common/.git", stderr: "" };
    if (args[0] === "--version") return { ok: true, stdout: "orca", stderr: "" };
    if (args[0] === "worktree" && args[1] === "current") return { ok: true, stdout: JSON.stringify({ result: { worktree: { id: "main", isMainWorktree: true } } }), stderr: "" };
    throw new Error(`unexpected ${args.join(" ")}`);
  });
  assert.deepEqual(mainConflict, { cleanup: "cleanup failed: invalid Orca current worktree response" });
  const calls: string[][] = []; const removed = await cleanup(pr(), mk("ok", calls)); assert.deepEqual(removed, { cleanup: "remove:captured-42" }); assert.ok(calls.some((c) => c.join(" ").includes("--worktree id:captured-42")));
  assert.deepEqual(await cleanup(pr(), mk("remove-fail", [])), { cleanup: "cleanup failed: conflict" });
});

test("force-with-lease allows rewritten HEAD through push guards but not unrelated safety checks", async () => {
  const { runner: baseRunner, calls } = fixture();
  const run = startRun(pr(), "review", null, false, clock);
  changeRun(pr(), run.id, (current) => { current.drafted_for_changes = true; });
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "branch" && args[1] === "--show-current") return { ok: true, stdout: "topic", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "rewritten", stderr: "" };
    if (command === "git" && args[0] === "status") return { ok: true, stdout: "", stderr: "" };
    if (command === "git" && args[0] === "merge-base") { calls.push(args); return { ok: true, stdout: "shared", stderr: "" }; }
    if (command === "git" && args[0] === "push") { calls.push(args); return { ok: true, stdout: "pushed", stderr: "" }; }
    return baseRunner(command, args, env, cwd);
  };
  await assert.rejects(() => push(pr(), run.id, ["--force-with-lease=refs/heads/topic:expected", "origin", "topic"], runner), /push verification/);
  assert.ok(calls.some((args) => args[0] === "merge-base" && args.includes(pr().headRefOid)));
  assert.ok(calls.some((args) => args[0] === "push"));
});

test("force-with-lease blocks when the PR head is unavailable or history is unrelated", async () => {
  const { runner: baseRunner, calls } = fixture();
  const run = startRun(pr(), "push", null, false, clock);
  changeRun(pr(), run.id, (current) => { current.drafted_for_changes = true; });
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "branch" && args[1] === "--show-current") return { ok: true, stdout: "topic", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "rewritten", stderr: "" };
    if (command === "git" && args[0] === "status") return { ok: true, stdout: "", stderr: "" };
    if (command === "git" && args[0] === "merge-base") return { ok: false, stdout: "", stderr: "fatal: Not a valid object name" };
    return baseRunner(command, args, env, cwd);
  };
  await assert.rejects(() => push(pr(), run.id, ["--force-with-lease", "origin", "topic"], runner), /PR head .*missing or shares no history/);
  assert.ok(!calls.some((args) => args[0] === "push"));
});
test("plain push allows local commits ahead of the PR head and blocks a rewritten HEAD", async () => {
  const make = (ancestor: boolean) => {
    const { runner: baseRunner, calls } = fixture();
    const runner: CommandRunner = async (command, args, env, cwd) => {
      if (command === "git" && args[0] === "branch" && args[1] === "--show-current") return { ok: true, stdout: "topic", stderr: "" };
      if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "ahead", stderr: "" };
      if (command === "git" && args[0] === "status") return { ok: true, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "merge-base") return { ok: ancestor, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "push") { calls.push(args); return { ok: true, stdout: "pushed", stderr: "" }; }
      return baseRunner(command, args, env, cwd);
    };
    return { runner, calls };
  };
  const run = startRun(pr(), "push", null, false, clock);
  changeRun(pr(), run.id, (current) => { current.drafted_for_changes = true; });
  const ahead = make(true);
  await assert.rejects(() => push(pr(), run.id, ["origin", "topic"], ahead.runner), /push verification/);
  assert.ok(ahead.calls.some((args) => args[0] === "push"));
  const rewritten = make(false);
  await assert.rejects(() => push(pr(), run.id, ["origin", "topic"], rewritten.runner), /working tree guard/);
  assert.ok(!rewritten.calls.some((args) => args[0] === "push"));
});

test("push blocks non-own PRs, force syntax, and protected branch targets", async () => {
  const runId = startRun(pr(), "push", null, false, { now: () => Date.now(), sleep: async () => {} }).id;
  await assert.rejects(push({ ...pr(), owner: "other" } as Snapshot, runId, [], fixture().runner), /push ownership/);
  for (const args of [["-f"], ["--force"], ["+topic"], ["origin", "main"], ["origin", "develop"]])
    await assert.rejects(push(null, runId, args, fixture().runner), /force push|protected branch/);
  await assert.rejects(draft({ ...pr(), owner: "other" } as Snapshot, runId, fixture().runner), /draft conversion/);
});

test("body preservation retains the complete evidence section", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-evidence-")); const file = join(dir, "body.md"); writeFileSync(file, "## Summary\nNew summary\n");
  const original = "## Evidence\nhead: aaaa\npacket: clean\n\n## Testing\npassed\n";
  const { runner } = fixture({ body: original });
  const result = await updateBody(pr(), file, true, runner);
  assert.equal(result.body, "## Summary\nNew summary\n\n## Evidence\nhead: aaaa\npacket: clean\n\n");
  rmSync(dir, { recursive: true, force: true });
});

test("A13 body projectCards failure falls back to REST PATCH and confirms re-read", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-body-")); const file = join(dir, "body.md"); writeFileSync(file, "Updated body\n");
  const { runner, calls } = fixture();
  const result = await updateBody(pr(), file, false, runner);
  assert.deepEqual(result, { updated: true, body: "Updated body\n" });
  assert.ok(calls.some((call) => call.includes("PATCH"))); assert.ok(calls.some((call) => call.at(-1) === "body"));
  rmSync(dir, { recursive: true, force: true });
});

test("R3 every mutating subcommand rejects missing --run before API use", async () => {
  const commands = [["guard"], ["draft"], ["push"], ["rerequest"], ["body"], ["attach"], ["merge"], ["cleanup"], ["checks", "rerun-cancelled"], ["stack", "link"]];
  for (const args of commands) { let calls = 0; const result = await dispatchCli([...args, "7"], async () => { calls++; return { ok: true, stdout: "", stderr: "" }; }); assert.notEqual(result.exitCode, 0, args.join(" ")); assert.match(result.stderr, /requires --run/); assert.equal(calls, 0); }
});

test("R7 authorize resolves modules when invoked through a symlinked scripts directory", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-contract-link-"));
  try {
    const scripts = join(dir, "scripts"); symlinkSync(resolve("scripts"), scripts, "dir");
    const { stdout } = await import("node:child_process").then(({ execFileSync }) => ({ stdout: execFileSync(process.execPath, [join(scripts, "pr.ts"), "authorize", "review", "--owner", "other"], { encoding: "utf8" }) }));
    assert.match(stdout, /"post-review"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
