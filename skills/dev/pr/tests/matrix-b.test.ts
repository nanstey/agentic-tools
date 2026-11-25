import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchCli, type CommandRunner } from "../scripts/pr.ts";
import { prStatePath, readPrStore } from "../../../../lib/pr/store.ts";

const head = "a".repeat(40);
const base = "b".repeat(40);
let postedReview: unknown;
const prData = {
  title: "Feature (#7)", url: "https://github.com/acme/repo/pull/7", state: "OPEN", isDraft: false,
  headRefOid: head, headRefName: "topic", baseRefOid: base, baseRefName: "main", mergeStateStatus: "CLEAN",
  reviewDecision: null, author: { login: "me" }, isCrossRepository: false, number: 7,
  commits: { nodes: [{ commit: { oid: head, committedDate: "2025-01-01T00:00:00Z", statusCheckRollup: { contexts: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } }] },
  recentCommits: { nodes: [{ commit: { oid: head } }] },
  comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  reviewThreads: { nodes: [{ id: "THREAD", isResolved: false, comments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } }], pageInfo: { hasNextPage: false, endCursor: null } },
  reviewRequests: { nodes: [] },
};

type Row = { name: string; success: string[]; blocked: string[]; failure: string[]; apiFailure?: boolean; run?: boolean; localOnly?: boolean };
const rows: Row[] = [
  { name: "checks inventory", success: ["checks", "inventory", "7"], blocked: ["checks", "inventory", "7"], failure: ["checks", "inventory", "7"], apiFailure: true },
  { name: "checks rerun-cancelled", success: ["checks", "rerun-cancelled", "7", "--run", "RUN"], blocked: ["checks", "rerun-cancelled", "7"], failure: ["checks", "rerun-cancelled", "7", "--run", "RUN"], apiFailure: true, run: true },
  { name: "checks wait", success: ["checks", "wait", "7", "--required", "ci", "--force"], blocked: ["checks", "wait", "7"], failure: ["checks", "wait", "7", "--required", "ci"], apiFailure: true },
  { name: "body", success: ["body", "7", "--run", "RUN", "--file", "BODY"], blocked: ["body", "7"], failure: ["body", "7", "--run", "RUN", "--file", "BODY"], apiFailure: true, run: true },
  { name: "attach", success: ["attach", "7", "--run", "RUN", "--file", "BODY", "--cap", "CAP"], blocked: ["attach", "7"], failure: ["attach", "7", "--run", "RUN", "--file", "BODY", "--cap", "CAP"], apiFailure: true, run: true },
  { name: "merge", success: ["merge", "7", "--run", "RUN", "--force", "--required", "ci"], blocked: ["merge", "7"], failure: ["merge", "7", "--run", "RUN", "--force", "--required", "ci"], apiFailure: true, run: true },
  { name: "cleanup", success: ["cleanup", "7", "--run", "RUN"], blocked: ["cleanup", "7"], failure: ["cleanup", "7", "--run", "RUN"], apiFailure: true, run: true },
  { name: "marker", success: ["marker", "7", "--head", head, "--verdict", "COMMENT"], blocked: ["marker", "7", "--head", "bad", "--verdict", "COMMENT"], failure: ["marker", "7", "--head", head, "--verdict", "COMMENT"], apiFailure: true },
  { name: "packet put", success: ["packet", "put", "7", "--run", "RUN", "--base", base, "--head", head, "--policy", "p", "--depth", "deep", "--reason", "test", "--verdict", "clean"], blocked: ["packet", "put", "7"], failure: ["packet", "put", "7", "--run", "RUN", "--base", base, "--head", head, "--policy", "p", "--depth", "deep", "--reason", "test", "--verdict", "clean"], apiFailure: true, run: true },
  { name: "packet get", success: ["packet", "get", "7", "--base", base, "--head", head, "--policy", "p"], blocked: ["packet", "get", "7"], failure: ["packet", "get", "7"], apiFailure: true },
  { name: "react add", success: ["react", "add", "7", "--run", "RUN"], blocked: ["react", "add", "7"], failure: ["react", "add", "7", "--run", "RUN"], apiFailure: true, run: true },
  { name: "react remove", success: ["react", "remove", "7", "--run", "RUN"], blocked: ["react", "remove", "7"], failure: ["react", "remove", "7", "--run", "RUN"], apiFailure: true, run: true },
  { name: "review post", success: ["review", "post", "7", "--run", "RUN", "--event", "COMMENT", "--body-file", "BODY"], blocked: ["review", "post", "7", "--event", "COMMENT", "--body-file", "BODY"], failure: ["review", "post", "7", "--run", "RUN", "--event", "COMMENT", "--body-file", "BODY"], apiFailure: true, run: true },
  { name: "thread reply", success: ["thread", "reply", "7", "--run", "RUN", "--thread", "THREAD", "--body-file", "BODY"], blocked: ["thread", "reply", "7", "--thread", "THREAD", "--body-file", "BODY"], failure: ["thread", "reply", "7", "--run", "RUN", "--thread", "THREAD", "--body-file", "BODY"], apiFailure: true, run: true },
  { name: "thread resolve", success: ["thread", "resolve", "7", "--run", "RUN", "--thread", "THREAD"], blocked: ["thread", "resolve", "7", "--thread", "THREAD"], failure: ["thread", "resolve", "7", "--run", "RUN", "--thread", "THREAD"], apiFailure: true, run: true },
  { name: "disclosure", success: ["disclosure"], blocked: ["disclosure", "--kind", "invalid"], failure: ["disclosure", "--kind", "invalid"], apiFailure: true },
  { name: "docs-only", success: ["docs-only", "BASE", "HEAD"], blocked: ["docs-only"], failure: ["docs-only"], localOnly: true },
  { name: "docs-only recorded", success: ["docs-only", base, head, "--run", "RUN", "--pr", "7"], blocked: ["docs-only", base, head, "--run", "RUN"], failure: ["docs-only"], localOnly: true, run: true },
  { name: "stack probe", success: ["stack", "probe"], blocked: ["stack", "unknown"], failure: ["stack", "probe"], apiFailure: true },
  { name: "stack link", success: ["stack", "link", "--repo", "acme/repo", "7", "8", "--run", "RUN"], blocked: ["stack", "link", "--repo", "acme/repo", "7", "--run", "RUN"], failure: ["stack", "link", "--repo", "acme/repo", "7", "8", "--run", "RUN"], apiFailure: true, run: true },
  { name: "stack collapse-check", success: ["stack", "collapse-check", head, base], blocked: ["stack", "collapse-check", head], failure: ["stack", "collapse-check"], localOnly: true },
];

function runner(options: { apiFailure?: boolean; body?: string; attachDeferred?: boolean; otherOwner?: boolean; merged?: boolean } = {}): CommandRunner {
  let body = options.body ?? "";
  const ok = (stdout = "") => ({ ok: true, stdout, stderr: "" });
  return async (command, args) => {
    if (command === "gh" && options.apiFailure) return { ok: false, stdout: "", stderr: "HTTP 403 rate limit exceeded" };
    if (command === "git") {
      if (args[0] === "rev-parse" && args.includes("--verify")) return { ok: false, stdout: "", stderr: "fatal: Needed a single revision" };
      if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok(process.cwd());
      if (args[0] === "rev-parse" && args[1] === "HEAD") return ok(head);
      if (args[0] === "rev-parse") return ok("/repo/.git\n");
      if (args[0] === "rev-list") return ok("0\n");
      if (args[0] === "branch" && args[1] === "--show-current") return ok("topic\n");
      if (args[0] === "status") return ok("");
      if (args[0] === "diff") return ok("");
      if (args[0] === "merge-base") return ok("");
      if (args[0] === "config" && args[1] === "--get") return { ok: false, stdout: "", stderr: "", exitCode: 1 };
      return ok("");
    }
    if (command !== "gh") return ok("");
    if (args[0] === "--version") return ok(options.attachDeferred ? "gh version 2.98.0" : "gh version 2.99.0");
    if (args[0] === "auth" || args[0] === "extension") return ok(args[0] === "extension" ? "" : "Logged in");
    if (args[0] === "repo") return ok(JSON.stringify({ nameWithOwner: "acme/repo", viewerPermission: "WRITE", url: "https://github.com/acme/repo" }));
    if (args[0] === "pr" && args[1] === "view" && args.at(-1) === "number,url") return ok(JSON.stringify({ number: 7, url: prData.url }));
    if (args[0] === "pr" && args[1] === "view" && args.at(-1) === "body") return ok(JSON.stringify({ body }));
    if (args[0] === "pr" && args[1] === "view") return ok(JSON.stringify({ ...prData, state: options.merged ? "MERGED" : prData.state, author: { login: options.otherOwner ? "author" : "me" }, body }));
    if (args[0] === "pr" && args[1] === "edit") { const file = args[args.indexOf("--body-file") + 1]!; body = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8")); return ok(); }
    if (args[0] === "pr" && args[1] === "merge") return ok();
    if (args[0] === "api" && args[1] === "user") return ok("me");
    if (args[0] === "api" && args.includes("--input")) { postedReview = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(args[args.indexOf("--input") + 1]!, "utf8"))); return ok('{"id":1}'); }
    if (args[0] === "api" && args[1] === "graphql") return ok(JSON.stringify({ data: { repository: { pullRequest: prData } } }));
    if (args[0] === "api" && args[1]?.match(/\/pulls\/[78]$/)) { const n = args[1].split("/").at(-1); return ok(JSON.stringify({ head: { sha: n === "7" ? "h7" : "h8" }, base: { sha: n === "7" ? "b7" : "h7" } })); }
    if (args[0] === "api" && args[1]?.includes("/pulls/7") && args[1]!.includes("/reviews")) return ok('{"id":1}');
    if (args[0] === "api" && args[1]?.includes("/pulls/7")) return ok(JSON.stringify({ stack: null }));
    if (args[0] === "api" && args[1]?.includes("/stacks")) return args.includes("POST") ? ok("{}") : { ok: false, stdout: "", stderr: "HTTP 404 not found" };
    if (args[0] === "api" && args.some((arg) => arg.includes("/reviews"))) return ok("[]");
    if (args[0] === "api" && args[1]?.includes("/branches/")) return ok("{}");
    if (args[0] === "api" && args[1]?.includes("/rulesets")) return ok("[]");
    if (args[0] === "api" && args[1]?.includes("/workflows")) return ok(JSON.stringify({ workflows: [] }));
    if (args[0] === "api" && args.some((arg) => arg.includes("/reactions"))) return ok("[]");
    if (args[0] === "api" && args[1]?.startsWith("repos/")) return ok("{}");
    return ok("");
  };
}

for (const row of rows) {
  test(`A5 ${row.name}: dispatch contract`, async () => {
    const previous = process.env.XDG_STATE_HOME;
    const stateHome = mkdtempSync(join(tmpdir(), "pr-matrix-b-"));
    const temp = mkdtempSync(join(tmpdir(), "pr-matrix-files-"));
    process.env.XDG_STATE_HOME = stateHome;
    try {
      const bodyFile = join(temp, "body.md"); writeFileSync(bodyFile, "Updated body\n");
      const cap = join(temp, "capture", "a", "b"); await import("node:fs/promises").then(({ mkdir }) => mkdir(cap, { recursive: true, mode: 0o700 }));
      const replace = (args: string[]) => args.map((arg) => arg === "RUN" ? runId : arg === "BODY" ? bodyFile : arg === "CAP" ? cap : arg);
      const otherOwner = row.name === "review post" || row.name === "thread reply";
      const action = row.name === "checks rerun-cancelled" ? "ci" : row.name === "body" ? "description" : row.name === "attach" ? "screenshots" : row.name === "merge" || row.name === "cleanup" ? "merge" : row.name === "thread resolve" ? "comments" : row.name === "stack link" ? "stack" : row.name.startsWith("react ") ? "lifecycle" : row.name === "review post" ? "review" : row.name === "thread reply" ? "verification" : "review";
      const mode = row.name === "review post" || row.name === "thread reply" ? "comment" : "none";
      const okRunner = runner({ attachDeferred: row.name === "attach", otherOwner, merged: row.name === "cleanup" });
      let runId = "";
      if (row.run) {
        const started = await dispatchCli(["run", "start", "--pr", "7", "--action", action, "--mode", mode], okRunner);
        assert.equal(started.exitCode, 0, started.stderr);
        runId = JSON.parse(started.stdout).run.id;
      }
      const ok = await dispatchCli(replace(row.success), okRunner, { now: () => 0, sleep: async () => {} });
      assert.equal(ok.exitCode, 0, ok.stderr);
      assert.equal(ok.stderr, "");
      assert.equal(ok.stdout.trim().split("\n").length, 1);
      assert.equal(typeof JSON.parse(ok.stdout), "object");
      if (row.name === "body") assert.deepEqual(readPrStore(prStatePath({ owner: "acme", repo: "repo", number: 7 }), { owner: "acme", repo: "repo", number: 7 }).describedHeads, [head]);
      if (row.name === "review post") assert.deepEqual(postedReview, { commit_id: head, event: "COMMENT", body: "Updated body\n", comments: [] });
      if (row.name === "docs-only recorded") assert.deepEqual(readPrStore(prStatePath({ owner: "acme", repo: "repo", number: 7 }), { owner: "acme", repo: "repo", number: 7 }).docsOnlyResults, { [`${base}..${head}`]: false });

      const blocked = await dispatchCli(replace(row.blocked), row.name === "checks inventory" ? runner({ apiFailure: true }) : okRunner);
      assert.notEqual(blocked.exitCode, 0);
      assert.match(blocked.stderr.trimEnd(), /^blocked: .+ — .+; unblock requires: .+$/);

      if (row.apiFailure) {
        const failed = await dispatchCli(replace(row.failure), runner({ apiFailure: true }));
        assert.notEqual(failed.exitCode, 0);
        assert.equal(failed.stdout, "");
      } else {
        // N/A: this operation does not call a GitHub API, so use invalid arguments instead.
        const invalid = await dispatchCli(replace(row.failure), okRunner);
        assert.notEqual(invalid.exitCode, 0);
        assert.match(invalid.stderr.trimEnd(), /^blocked: .+ — .+; unblock requires: .+$/);
      }
    } finally {
      if (previous === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = previous;
      rmSync(stateHome, { recursive: true, force: true });
      rmSync(temp, { recursive: true, force: true });
    }
  });
}
