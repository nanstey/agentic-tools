import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchCli, type CommandRunner } from "../scripts/pr.ts";

const head = "a".repeat(40);
const base = "b".repeat(40);
const pr = {
  title: "Feature (#7)", url: "https://github.com/acme/repo/pull/7", state: "OPEN", isDraft: false,
  headRefOid: head, headRefName: "topic", baseRefOid: base, baseRefName: "main", mergeStateStatus: "CLEAN",
  reviewDecision: null, author: { login: "me" }, isCrossRepository: false, number: 7,
  commits: { nodes: [{ commit: { oid: head, committedDate: "2025-01-01T00:00:00Z", statusCheckRollup: { contexts: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } }] },
  recentCommits: { nodes: [{ commit: { oid: head } }] },
  comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  reviewRequests: { nodes: [] },
};

function success(stdout = ""): { ok: true; stdout: string; stderr: string } { return { ok: true, stdout, stderr: "" }; }
function fakeRunner(): CommandRunner {
  const state = { draft: false, pushed: false };
  return async (command, args) => command === "git" ? gitResult(args, state) : command === "gh" ? ghResult(args, state) : success();
}
function gitResult(args: string[], state: { pushed: boolean }): ReturnType<typeof success> {
  const outputs: Record<string, string> = { branch: "topic\n", "rev-list": "0\n", "status": "", "ls-tree": "" };
  if (args[0] === "push") { state.pushed = true; return success(); }
  if (args[0] === "rev-parse") return success(`${state.pushed ? "c".repeat(40) : head}\n`);
  return success(outputs[args[0] ?? ""] ?? "");
}
function ghResult(args: string[], state: { draft: boolean; pushed: boolean }): ReturnType<typeof success> {
  if (args[0] === "pr") return ghPr(args, state);
  if (args[0] === "api") return ghApi(args, state);
  return success();
}
function ghPr(args: string[], state: { draft: boolean; pushed: boolean }): ReturnType<typeof success> {
  if (args[1] === "view") return prView(args, state);
  if (args[1] === "ready") { state.draft = true; return success(); }
  return success();
}
function ghApi(args: string[], state: { draft: boolean; pushed: boolean }): ReturnType<typeof success> {
  if (args[1] === "user") return success("me");
  if (args[1] === "graphql") return graphqlResult(args, state);
  if (args.includes("--paginate")) return success("[]");
  if (args.at(-1)?.includes("requested_reviewers")) return success(JSON.stringify({ users: [] }));
  return success(args[1]?.startsWith("repos/") ? "{}" : "");
}
function prView(args: string[], state: { draft: boolean; pushed: boolean }): ReturnType<typeof success> {
  if (args.at(-1) === "number,url") return success(JSON.stringify({ number: 7, url: "https://github.com/acme/repo/pull/7" }));
  return success(JSON.stringify({ ...pr, headRefOid: state.pushed ? "c".repeat(40) : head, isDraft: state.draft }));
}
function graphqlResult(args: string[], state: { draft: boolean; pushed: boolean }): ReturnType<typeof success> {
  if (args.some((arg) => arg.includes("reviewThreads(first:100,after:$c)"))) return success(JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } } }));
  return success(JSON.stringify({ data: { repository: { pullRequest: { ...pr, isDraft: state.draft, headRefOid: state.pushed ? "c".repeat(40) : head } } } }));
}

type Row = { name: string; success: string[]; blocked: string[]; apiFailure?: boolean; seedRun?: boolean };
const rows: Row[] = [
  { name: "snapshot", success: ["snapshot", "7"], blocked: ["snapshot"], apiFailure: true },
  { name: "next", success: ["next", "7", "--run", "RUN"], blocked: ["next"], apiFailure: true, seedRun: true },
  { name: "authorize", success: ["authorize", "review", "--owner", "other"], blocked: ["authorize"], apiFailure: false },
  { name: "run start", success: ["run", "start", "--pr", "7", "--action", "review"], blocked: ["run", "start"], apiFailure: true },
  { name: "run get", success: ["run", "get", "--pr", "7", "--run", "RUN"], blocked: ["run", "get"], apiFailure: true, seedRun: true },
  { name: "run update", success: ["run", "update", "--pr", "7", "--run", "RUN", "--round", "2"], blocked: ["run", "update"], apiFailure: true, seedRun: true },
  { name: "run end", success: ["run", "end", "--pr", "7", "--run", "RUN"], blocked: ["run", "end"], apiFailure: true, seedRun: true },
  { name: "guard", success: ["guard", "7", "--run", "RUN"], blocked: ["guard"], apiFailure: true, seedRun: true },
  { name: "draft", success: ["draft", "7", "--run", "RUN"], blocked: ["draft"], apiFailure: true, seedRun: true },
  { name: "push", success: ["push", "7", "--run", "RUN"], blocked: ["push"], apiFailure: true, seedRun: true },
  { name: "threads", success: ["threads", "7"], blocked: ["threads"], apiFailure: true },
  { name: "rerequest", success: ["rerequest", "7", "--run", "RUN", "--dry-run"], blocked: ["rerequest"], apiFailure: true, seedRun: true },
];

for (const row of rows) {
  test(`A5 ${row.name}: dispatch contract`, async () => {
    const previous = process.env.XDG_STATE_HOME;
    const stateHome = mkdtempSync(join(tmpdir(), "pr-matrix-"));
    process.env.XDG_STATE_HOME = stateHome;
    try {
      const runner = fakeRunner();
      let runId = "";
      if (row.seedRun) {
        const action = row.name === "draft" ? "lifecycle" : row.name === "push" ? "push" : row.name === "rerequest" ? "comments" : "ci";
        const seeded = await dispatchCli(["run", "start", "--pr", "7", "--action", action], runner);
        assert.equal(seeded.exitCode, 0, seeded.stderr);
        runId = JSON.parse(seeded.stdout).run.id;
        if (row.name === "push") await dispatchCli(["run", "update", "--pr", "7", "--run", runId, "--drafted-for-changes"], runner);
      }
      const success = row.success.map((part) => part === "RUN" ? runId : part);
      const ok = await dispatchCli(success, runner);
      assert.equal(ok.exitCode, 0, ok.stderr);
      assert.equal(ok.stderr, "");
      assert.equal(ok.stdout.trim().split("\n").length, 1);
      assert.equal(typeof JSON.parse(ok.stdout), "object");

      const blocked = await dispatchCli(row.blocked, async (command, args, env, cwd, timeout) => command === "gh"
        ? { ok: false, stdout: "", stderr: "HTTP 403 rate limit exceeded" }
        : runner(command, args, env, cwd, timeout));
      assert.notEqual(blocked.exitCode, 0);
      assert.match(blocked.stderr, /^blocked: .+ — .+; unblock requires: .+\n$/);

      if (row.apiFailure) {
        const failed = await dispatchCli(success, async (command, args, env, cwd, timeout) => command === "gh"
          ? { ok: false, stdout: "", stderr: "HTTP 403 rate limit exceeded" }
          : runner(command, args, env, cwd, timeout));
        assert.notEqual(failed.exitCode, 0);
        assert.equal(failed.stdout, "");
      } else {
        // N/A: authorize is local-only, so use invalid arguments instead of an API failure.
        const invalid = await dispatchCli(["authorize"], runner);
        assert.notEqual(invalid.exitCode, 0);
        assert.match(invalid.stderr, /^blocked: .+ — .+; unblock requires: .+\n$/);
      }
    } finally {
      if (previous === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = previous;
      rmSync(stateHome, { recursive: true, force: true });
    }
  });
}
