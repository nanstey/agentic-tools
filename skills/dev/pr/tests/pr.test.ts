import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execute, nextPhase, type CommandRunner, type Clock } from "../scripts/pr.ts";
import { isPlaceholderDescription } from "../scripts/core/facts.ts";
import { prStatePath, readPrStore } from "../../../../lib/pr/store.ts";
import { refresh, type Snapshot } from "../scripts/core/resolve.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-test-state-"));
const oldStateHome = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = stateHome;
const head = "a".repeat(40);
const base = "b".repeat(40);
const clock: Clock = { now: () => 1_735_689_600_000, sleep: async () => {} };
after(() => { if (oldStateHome === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldStateHome; rmSync(stateHome, { recursive: true, force: true }); });

function fixture(failAt?: string): { runner: CommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: CommandRunner = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: process.cwd(), stderr: "" };
    const joined = args.join(" ");
    if (failAt && joined.includes(failAt)) return { ok: false, stdout: "", stderr: `API error: ${failAt}` };
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && args.includes("number,url")) return { ok: true, stdout: JSON.stringify({ number: 7, url: "https://github.com/acme/repo/pull/7" }), stderr: "" };
    if (command === "gh" && args[0] === "pr" && args[1] === "view") return { ok: true, stdout: JSON.stringify({ author: { login: "me" }, headRefName: "topic", headRefOid: head, baseRefName: "main", baseRefOid: base, isCrossRepository: false, isDraft: false, state: "OPEN", url: "https://github.com/acme/repo/pull/7", title: "Feature (#7)", body: "## Summary\nFeature\n## Changes\nUpdated\n## Testing\nPassed" }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1] === "user") return { ok: true, stdout: "me", stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1] === "graphql" && args.join(" ").includes("reviewThreads(first:100,after:$c)")) return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } } }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1] === "graphql") {
      const pr = { title: "Feature (#7)", body: "## Summary\nFeature\n## Changes\nUpdated\n## Testing\nPassed", url: "https://github.com/acme/repo/pull/7", state: "OPEN", isDraft: false, headRefOid: head, headRefName: "topic", mergeStateStatus: "CLEAN", reviewDecision: null, commits: { nodes: [{ commit: { oid: head, committedDate: "2025-01-01T00:00:00Z", statusCheckRollup: { contexts: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } }] }, recentCommits: { nodes: [{ commit: { oid: head } }] }, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }, reviewRequests: { nodes: [] } };
      return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: pr } } }), stderr: "" };
    }
    if (command === "gh" && args[0] === "api" && joined.includes("pulls/7/reviews?per_page=100")) return { ok: true, stdout: "[]", stderr: "" };
    if (command === "gh" && args[0] === "api" && joined.includes("requested_reviewers")) return { ok: true, stdout: JSON.stringify({ users: [] }), stderr: "" };
    if (command === "gh" && args[0] === "api" && joined.includes("pulls/7")) return { ok: true, stdout: JSON.stringify({ stack: null }), stderr: "" };
    return { ok: true, stdout: "", stderr: "" };
  };
  return { runner, calls };
}

test("snapshot without a PR returns the current repository, branch, and head; next selects create phase", async () => {
  const runner: CommandRunner = async (command, args) => {
    if (command === "gh" && args[0] === "pr" && args[1] === "view") return { ok: false, stdout: "", stderr: "no pull requests found for branch" };
    if (command === "gh" && args[0] === "repo") return { ok: true, stdout: "acme/repo", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: "/repo", stderr: "" };
    if (command === "git" && args[0] === "branch") return { ok: true, stdout: "topic", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: head, stderr: "" };
    return { ok: true, stdout: "", stderr: "" };
  };
  assert.deepEqual(await execute(["snapshot"], runner), { exists: false, repo: "acme/repo", branch: "topic", head });
  assert.deepEqual(await execute(["next"], runner), { phase: 1, name: "Create", reason: "no PR exists"});
});
test("refresh resolves from the snapshot URL, not the current branch", async () => {
  const { runner: baseRunner, calls } = fixture();
  const pr = (await execute(["snapshot", "7"], baseRunner) as { snapshot: Snapshot }).snapshot;
  calls.length = 0;
  await refresh(pr, async (command, args, env, cwd) => { calls.push([command, ...args]); return baseRunner(command, args, env, cwd); });
  assert.ok(calls.some((call) => call[0] === "gh" && call[1] === "pr" && call.includes(pr.url)));
});
test("snapshot returns complete normalized PR metadata", async () => {
  const { runner } = fixture();
  const result = await execute(["snapshot", "7"], runner) as { snapshot: { owner: string; headRefOid: string; stack: unknown } };
  assert.equal(result.snapshot.owner, "own"); assert.equal(result.snapshot.headRefOid, head); assert.equal(result.snapshot.stack, null);
});
test("snapshot fetches later review, comment, thread, and check pages", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command !== "gh" || args[0] !== "api" || args[1] !== "graphql") return baseRunner(command, args, env, cwd);
    calls.push([command, ...args]);
    const second = args.some((arg) => /Cursor=next/.test(arg));
    const actor = { login: "reviewer", __typename: "User" };
    const comment = { createdAt: "2025-01-02", author: actor };
    const check = { __typename: "StatusContext", context: "ci", state: "SUCCESS", targetUrl: null };
    const page = (nodes: unknown[]) => ({ nodes: second ? nodes : [], pageInfo: { hasNextPage: !second, endCursor: second ? null : "next" } });
    const pr = { title: "Feature", url: "https://github.com/acme/repo/pull/7", state: "OPEN", isDraft: false, headRefOid: head, headRefName: "topic", mergeStateStatus: "CLEAN", reviewDecision: null,
      commits: { nodes: [{ commit: { oid: head, committedDate: "2025-01-01", statusCheckRollup: { contexts: page([check]) } } }] }, recentCommits: { nodes: [{ commit: { oid: head } }] },
      comments: page([comment]), reviews: page([{ submittedAt: "2025-01-02", state: "APPROVED", body: "", commit: { oid: head }, author: actor }]), reviewThreads: page([{ isResolved: true, comments: { nodes: [comment] } }]), reviewRequests: { nodes: [] } };
    return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: pr } } }), stderr: "" };
  };
  const result = await execute(["snapshot", "7"], runner) as { snapshot: { comments: unknown[]; reviews: unknown[]; threads: unknown[]; checks: unknown[] } };
  assert.equal(result.snapshot.comments.length, 1); assert.equal(result.snapshot.reviews.length, 1);
  assert.equal(result.snapshot.threads.length, 1); assert.equal(result.snapshot.checks.length, 1);
  assert.ok(calls.some((call) => call.some((arg) => /Cursor=next/.test(arg))));
});
test("snapshot API errors block instead of producing a successful result", async () => {
  const { runner } = fixture("graphql");
  await assert.rejects(() => execute(["snapshot", "7"], runner), /blocked: gh API/);
});
test("mutations reject a missing run before making API calls", async () => {
  const { runner, calls } = fixture();
  await assert.rejects(() => execute(["draft", "7"], runner), /requires --run/);
  assert.equal(calls.length, 0);
});
test("authorization returns per-owner mutation allowances", async () => {
  const { runner } = fixture();
  const own = await execute(["authorize", "review", "--owner", "own"], runner) as { allowed: string[] };
  const other = await execute(["authorize", "review", "--owner", "other"], runner) as { allowed: string[] };
  const fork = await execute(["authorize", "review", "--owner", "fork"], runner) as { allowed: string[] };
  assert.deepEqual(own.allowed, []); assert.ok(other.allowed.includes("post-review")); assert.ok(fork.allowed.includes("post-review"));
});
test("next uses snapshot, git, policy, reviewer, and run facts deterministically", async () => {
  const { runner } = fixture();
  const first = await execute(["next", "7", "--run", "fixture-run"], runner);
  const second = await execute(["next", "7", "--run", "fixture-run"], runner);
  assert.deepEqual(first, second);
  assert.deepEqual(first, { needs_judgment: "description-staleness" });
  const judged = await execute(["next", "7", "--run", "fixture-run", "--judged", "description-staleness=pass", "--judged", "ui-evidence=pass", "--judged", "required-check-policy=pass"], runner) as { phase?: number };
  assert.equal(judged.phase, 5);
  await assert.rejects(() => execute(["next", "7", "--run", "fixture-run", "--judged", "description staleness=pass"], runner), /blocked: judgment input/);
});
test("next treats a stored review packet for the current head as complete for another author's PR", async () => {
  const { runner } = fixture();
  const otherRunner: CommandRunner = async (command, args, env, cwd) => {
    const result = await runner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const value = JSON.parse(result.stdout) as Record<string, unknown>;
      value.author = { login: "another-author" };
      return { ...result, stdout: JSON.stringify(value) };
    }
    return result;
  };
  const started = await execute(["run", "start", "--pr", "7", "--action", "review", "--mode", "report"], otherRunner) as { run: { id: string } };
  const policy = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  await execute(["packet", "put", "7", "--run", started.run.id, "--base", "b".repeat(40), "--head", "a".repeat(40), "--policy", policy, "--depth", "standard", "--reason", "review", "--verdict", "incomplete"], otherRunner);
  assert.deepEqual(await execute(["next", "7", "--run", started.run.id], otherRunner), { phase: 6, name: "Review", reason: "run a report-only review for another author's PR" });
  await execute(["packet", "put", "7", "--run", started.run.id, "--base", "c".repeat(40), "--head", "a".repeat(40), "--policy", policy, "--depth", "standard", "--reason", "review", "--verdict", "clean"], otherRunner);
  assert.deepEqual(await execute(["next", "7", "--run", started.run.id], otherRunner), { phase: 6, name: "Review", reason: "run a report-only review for another author's PR" });
  await execute(["packet", "put", "7", "--run", started.run.id, "--base", "b".repeat(40), "--head", "a".repeat(40), "--policy", policy, "--depth", "standard", "--reason", "review", "--verdict", "clean"], otherRunner);
  assert.deepEqual(await execute(["next", "7", "--run", started.run.id], otherRunner), { phase: null, status: "complete" });
});

test("URL snapshots remain read-only when cwd is not a git checkout", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: false, stdout: "", stderr: "fatal: not a git repository" };
    calls.push([command, ...args]);
    return baseRunner(command, args, env, cwd);
  };
  const result = await execute(["snapshot", "https://github.com/acme/repo/pull/7"], runner) as { policy: string | null };
  assert.equal(result.policy, null);
  assert.ok(calls.some((call) => call[0] === "gh" && call.includes("repos/acme/repo/pulls/7")));
});
test("packet put and get default policy hashes from the validated packet head", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "ls-tree") { calls.push([command, ...args]); return { ok: true, stdout: "", stderr: "" }; }
    return baseRunner(command, args, env, cwd);
  };
  const started = await execute(["run", "start", "--pr", "7", "--action", "review"], runner) as { run: { id: string } };
  await execute(["packet", "put", "7", "--run", started.run.id, "--base", base, "--head", head, "--depth", "standard", "--reason", "review", "--verdict", "clean"], runner);
  const result = await execute(["packet", "get", "7", "--base", base, "--head", head], runner) as { packet: { policy: string } };
  assert.equal(result.packet.policy, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.ok(calls.some((call) => call[0] === "git" && call[1] === "ls-tree" && call.includes(head)));
});
test("snapshot and lifecycle tolerate a PR head unavailable in the local object database", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "ls-tree") { calls.push([command, ...args]); return { ok: false, stdout: "", stderr: "fatal: not a tree object" }; }
    return baseRunner(command, args, env, cwd);
  };
  const result = await execute(["snapshot", "7"], runner) as { policy: string | null };
  assert.equal(result.policy, null);
  assert.ok(calls.some((call) => call.join(" ").includes("ls-tree -r -z")));
  await execute(["next", "7", "--run", "fixture-run"], runner);
  await assert.rejects(() => execute(["packet", "get", "7", "--base", base, "--head", head], runner), /fetch pull\/7\/head first/);

  for (const bad of ["HEAD:dir", "-x", head.toUpperCase()]) await assert.rejects(() => execute(["packet", "get", "7", "--base", base, "--head", bad], runner), /invalid head/);
});
test("next accepts a missing run and defaults automerge to false", async () => {
  const { runner } = fixture();
  assert.deepEqual(await execute(["next", "7"], runner), { needs_judgment: "description-staleness" });
});
test("next allows another author's PR without local git facts or a run", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git") return { ok: false, stdout: "", stderr: "fatal: not a git repository" };
    const result = await baseRunner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const value = JSON.parse(result.stdout) as Record<string, unknown>; value.author = { login: "someone-else" };
      return { ...result, stdout: JSON.stringify(value) };
    }
    return result;
  };
  const result = await execute(["next", "7"], runner);
  assert.deepEqual(result, { phase: 6, name: "Review", reason: "run a report-only review for another author's PR" });
  assert.ok(!calls.some((call) => call[0] === "git" && call[1] === "rev-list"));
  const forkRunner: CommandRunner = async (command, args, env, cwd) => {
    const result = await runner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const value = JSON.parse(result.stdout) as Record<string, unknown>; value.isCrossRepository = true;
      return { ...result, stdout: JSON.stringify(value) };
    }
    return result;
  };
  assert.deepEqual(await execute(["next", "7"], forkRunner), { phase: 6, name: "Review", reason: "run a report-only review for another author's PR" });
});
test("next ignores local commit facts when the current branch is not the PR head branch", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "branch" && args[1] === "--show-current") return { ok: true, stdout: "different-branch", stderr: "" };
    const result = await baseRunner(command, args, env, cwd);
    if (command === "git") calls.push([command, ...args]);
    return result;
  };
  const result = await execute(["next", "7", "--run", "fixture-run"], runner);
  assert.deepEqual(result, { needs_judgment: "description-staleness" });
  assert.ok(!calls.some((call) => call[1] === "rev-list"));
});
test("next blocks on incomplete local facts and API failure", async () => {
  const { runner: apiRunner } = fixture("graphql");
  await assert.rejects(() => execute(["next", "7", "--run", "fixture-run"], apiRunner), /blocked: gh API/);
});
test("run end records run completion and lastCompletion in one state update", async () => {
  const { runner } = fixture();
  const started = await execute(["run", "start", "--pr", "7", "--action", "review"], runner) as { run: { id: string } };
  await execute(["run", "end", "--pr", "7", "--run", started.run.id, "--completion", "pending"], runner);
  const store = readPrStore(prStatePath({ owner: "acme", repo: "repo", number: 7 }), { owner: "acme", repo: "repo", number: 7 });
  assert.equal(store.runs[started.run.id]?.completion, "pending");
  assert.equal(store.lastCompletion, "pending");
  await assert.rejects(() => execute(["run", "end", "--pr", "7", "--run", started.run.id, "--completion", "merged"], runner), /blocked: completion/);
});
test("run update refuses to reserve a sixth review round", async () => {
  const { runner } = fixture();
  const started = await execute(["run", "start", "--pr", "7", "--action", "review"], runner) as { run: { id: string } };
  await execute(["run", "update", "--pr", "7", "--run", started.run.id, "--round", "5"], runner);
  await assert.rejects(() => execute(["run", "update", "--pr", "7", "--run", started.run.id, "--round", "6"], runner), /blocked: round limit/);
});
test("phase-3 placeholder detection requires Summary, Changes, and Testing sections", () => {
  assert.equal(isPlaceholderDescription("Feature", "## Summary\nDone\n## Changes\nUpdated\n## Testing\nPassed"), false);
  assert.equal(isPlaceholderDescription("Feature", "## Summary\nDone\n## Changes\nUpdated"), true);
  assert.equal(isPlaceholderDescription("TODO: Feature", "## Summary\n## Changes\n## Testing"), true);
});
test("nextPhase selects phase 0 through 10 deterministically and reports judgment", () => {
  const facts = { resolved: true, exists: true, unpushed: false, dirtyValidated: false, placeholder: false, staleDescription: false, uiChangedNoScreenshots: false, behind: false, conflicting: false, stackOutOfOrder: false, checksObserved: true, requiredCheckFailedOrMissing: false, packetComplete: true, unresolvedThreads: 0, addressedReviewers: false, claimsUnverified: false, isDraft: false };
  for (let phase = 0; phase <= 10; phase++) {
    const input = { ...facts, ...(phase === 0 ? { resolved: false } : {}), ...(phase === 1 ? { exists: false } : {}), ...(phase === 2 ? { unpushed: true } : {}), ...(phase === 3 ? { placeholder: true } : {}), ...(phase === 4 ? { behind: true } : {}), ...(phase === 5 ? { checksObserved: false } : {}), ...(phase === 6 ? { packetComplete: false } : {}), ...(phase === 7 ? { unresolvedThreads: 1 } : {}), ...(phase === 8 ? { claimsUnverified: true } : {}), ...(phase === 9 ? { isDraft: true } : {}) };
    const state = phase === 10 ? { automerge: true } : {};
    const result = nextPhase(input, state);
    assert.equal("phase" in result ? result.phase : -1, phase);
  }
  assert.deepEqual(nextPhase({ ...facts, staleDescription: null }), { needs_judgment: "description-staleness" });
  assert.deepEqual(nextPhase({ ...facts, uiChangedNoScreenshots: undefined }), { needs_judgment: "ui-evidence" });
  assert.deepEqual(nextPhase({ ...facts, requiredCheckFailedOrMissing: null }), { needs_judgment: "required-check-policy" });
  const claimsJudgment = nextPhase({ ...facts, claimsUnverified: undefined });
  assert.equal("needs_judgment" in claimsJudgment ? claimsJudgment.needs_judgment : "", "claims-verification-evidence");
  const names = ["description-staleness", "ui-evidence", "required-check-policy", "claims-verification-evidence"];
  for (const name of names) assert.doesNotMatch(name, /\s/);
  assert.deepEqual(nextPhase(facts, { owner: "other", reviewReportComplete: true }), { phase: null, status: "complete" });
  assert.deepEqual(nextPhase(facts), nextPhase(facts));
});
test("stack link resolves PR numbers within the explicit repository", async () => {
  const { runner: baseRunner, calls } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    calls.push([command, ...args]);
    if (command === "gh" && args[0] === "api" && args[1] === "repos/fork/repo/pulls/7") return { ok: true, stdout: JSON.stringify({ base: { sha: "b7" }, head: { sha: "h7" } }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1] === "repos/fork/repo/pulls/8") return { ok: true, stdout: JSON.stringify({ base: { sha: "h7" }, head: { sha: "h8" } }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1] === "repos/fork/repo/stacks") return { ok: true, stdout: "{}", stderr: "" };
    return baseRunner(command, args, env, cwd);
  };
  const started = await execute(["run", "start", "--pr", "7", "--action", "stack"], runner) as { run: { id: string } };
  await execute(["stack", "link", "--repo", "fork/repo", "7", "8", "--run", started.run.id], runner);
  assert.ok(calls.some((call) => call[0] === "gh" && call.includes("https://github.com/fork/repo/pull/7")));
});
test("stack link requires a run on a listed PR and accepts one on the second listed PR", async () => {
  const { runner: baseRunner } = fixture();
  const runner: CommandRunner = async (command, args, env, cwd) => {
    const result = await baseRunner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && args.includes("number,url")) {
      const target = args.find((arg) => /pull\/\d+$/.test(arg)); const number = target?.split("/").at(-1) ?? "7";
      return { ...result, stdout: JSON.stringify({ number: Number(number), url: `https://github.com/acme/repo/pull/${number}` }) };
    }
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const target = args.find((arg) => /^\d+$/.test(arg)); const number = target ?? "7";
      const value = JSON.parse(result.stdout) as Record<string, unknown>; value.url = `https://github.com/acme/repo/pull/${number}`;
      return { ...result, stdout: JSON.stringify(value) };
    }
    if (command === "gh" && args[0] === "api" && args[1]?.includes("/pulls/7")) return { ok: true, stdout: JSON.stringify({ base: { sha: "b7" }, head: { sha: "h7" } }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1]?.includes("/pulls/8")) return { ok: true, stdout: JSON.stringify({ base: { sha: "h7" }, head: { sha: "h8" } }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1]?.includes("/pulls/9")) return { ok: true, stdout: JSON.stringify({ base: { sha: "b9" }, head: { sha: "h9" } }), stderr: "" };
    if (command === "gh" && args[0] === "api" && args[1]?.includes("/stacks")) return { ok: true, stdout: "{}", stderr: "" };
    return result;
  };
  const second = await execute(["run", "start", "--pr", "https://github.com/acme/repo/pull/8", "--action", "stack"], runner) as { run: { id: string } };
  const elsewhere = await execute(["run", "start", "--pr", "https://github.com/acme/repo/pull/9", "--action", "stack"], runner) as { run: { id: string } };
  await assert.rejects(() => execute(["stack", "link", "--repo", "acme/repo", "7", "8", "--run", elsewhere.run.id], runner), /does not belong to a listed PR/);
  await execute(["stack", "link", "--repo", "acme/repo", "7", "8", "--run", second.run.id], runner);
});
test("delegated body edits in ready and merge runs authorize against lifecycle", async () => {
  const { runner } = fixture();
  for (const action of ["ready", "merge"]) {
    const started = await execute(["run", "start", "--pr", "7", "--action", action], runner) as { run: { id: string } };
    await assert.rejects(() => execute(["body", "7", "--run", started.run.id, "--file", "/missing/body.md"], runner), /ENOENT/);
  }
});
test("cleanup blocks foreign PRs and dirty worktrees", async () => {
  const { runner: baseRunner } = fixture();
  const mergeRun = await execute(["run", "start", "--pr", "7", "--action", "merge"], baseRunner) as { run: { id: string } };
  const foreign: CommandRunner = async (command, args, env, cwd) => {
    const result = await baseRunner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const value = JSON.parse(result.stdout) as Record<string, unknown>; value.author = { login: "foreign" };
      return { ...result, stdout: JSON.stringify(value) };
    }
    return result;
  };
  await assert.rejects(() => execute(["cleanup", "7", "--run", mergeRun.run.id], foreign), /owner=other/);
  const fork: CommandRunner = async (command, args, env, cwd) => {
    const result = await baseRunner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const value = JSON.parse(result.stdout) as Record<string, unknown>; value.isCrossRepository = true;
      return { ...result, stdout: JSON.stringify(value) };
    }
    return result;
  };
  await assert.rejects(() => execute(["cleanup", "7", "--run", mergeRun.run.id], fork), /owner=fork/);
  const dirty: CommandRunner = async (command, args, env, cwd) => {
    if (command === "git" && args[0] === "status" && args[1] === "--porcelain") return { ok: true, stdout: "?? lost.txt\\n", stderr: "" };
    const result = await baseRunner(command, args, env, cwd);
    if (command === "gh" && args[0] === "pr" && args[1] === "view" && !args.includes("number,url")) {
      const value = JSON.parse(result.stdout) as Record<string, unknown>; value.state = "MERGED";
      return { ...result, stdout: JSON.stringify(value) };
    }
    return result;
  };
  await assert.rejects(() => execute(["cleanup", "7", "--run", mergeRun.run.id], dirty), /working tree is dirty/);
});
test("cleanup blocks open PRs and runs for unrelated actions", async () => {
  const { runner } = fixture();
  const reviewRun = await execute(["run", "start", "--pr", "7", "--action", "review"], runner) as { run: { id: string } };
  await assert.rejects(() => execute(["cleanup", "7", "--run", reviewRun.run.id], runner), /action=review/);
  const mergeRun = await execute(["run", "start", "--pr", "7", "--action", "merge"], runner) as { run: { id: string } };
  await assert.rejects(() => execute(["cleanup", "7", "--run", mergeRun.run.id], runner), /state=OPEN/);
});
test("thread mutations reject ids absent from the target PR", async () => {
  const { runner } = fixture();
  const started = await execute(["run", "start", "--pr", "7", "--action", "comments"], runner) as { run: { id: string } };
  await assert.rejects(() => execute(["thread", "reply", "7", "--run", started.run.id, "--thread", "NOT-ON-PR", "--body-file", "/missing"], runner), /thread belonging to the target PR/);
});
test("authorize resolves its script imports through a symlinked skill path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-link-"));
  try {
    const link = join(dir, "scripts"); symlinkSync(resolve("scripts"), link, "dir");
    const { stdout } = await import("node:child_process").then(({ execFileSync }) => ({ stdout: execFileSync(process.execPath, [join(link, "pr.ts"), "authorize", "review", "--owner", "other"], { encoding: "utf8" }) }));
    assert.match(stdout, /"post-review"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
