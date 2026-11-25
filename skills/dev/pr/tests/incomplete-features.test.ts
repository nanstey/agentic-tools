import test from "node:test";
import assert from "node:assert/strict";
import { docsOnly } from "../scripts/phases/06-docs-only.ts";
import { threads } from "../scripts/phases/07-threads.ts";
import { probe } from "../scripts/phases/04-stack.ts";
import type { CommandRunner } from "../scripts/core/runner.ts";

const pr = { repo: "acme/repo", number: 7 } as Parameters<typeof threads>[0];
test("thread snapshot reads every GraphQL page and fails on later page errors", async () => {
  let page = 0;
  const runner: CommandRunner = async (_command, args) => {
    if (args[0] !== "api" || !args.includes("graphql")) throw new Error("unexpected command");
    page++;
    if (page === 1) return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "a", isResolved: false, isOutdated: false, comments: { nodes: [], pageInfo: { hasNextPage: false } } }], pageInfo: { hasNextPage: true, endCursor: "next" } } } } } }), stderr: "" };
    return { ok: true, stdout: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "b", isResolved: true, isOutdated: true, comments: { nodes: [], pageInfo: { hasNextPage: false } } }], pageInfo: { hasNextPage: false, endCursor: null } } } } } }), stderr: "" };
  };
  assert.deepEqual(await threads(pr, runner), { unresolved: ["a"], outdated: ["b"], threads: [{ resolved: false, comments: [] }, { resolved: true, comments: [] }], total: 2 });
  assert.equal(page, 2);
});
test("docs-only compares raw modified Markdown without treating a renamed file as prose-only", async () => {
  const runner: CommandRunner = async (_command, args) => {
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: process.cwd(), stderr: "" };
    if (args[0] === "diff" && args.includes("--raw")) return { ok: true, stdout: ":100644 100644 abc def M\0notes.md\0", stderr: "" };
    if (args[0] === "cat-file") return { ok: true, stdout: "Plain text\n", stderr: "" };
    if (args[0] === "diff") return { ok: true, stdout: "diff --git a/notes.md b/notes.md\n+Plain text\n", stderr: "" };
    throw new Error(`unexpected ${args.join(" ")}`);
  };
  const clean = await docsOnly("base", "head", runner);
  assert.equal(clean.clean, true);
  const renamed: CommandRunner = async (_command, args) => args[0] === "rev-parse" && args[1] === "--show-toplevel"
    ? { ok: true, stdout: process.cwd(), stderr: "" }
    : args[0] === "diff" && args.includes("--raw")
    ? { ok: true, stdout: ":100644 100644 abc def R100\0old.md\0new.md\0", stderr: "" }
    : { ok: true, stdout: "", stderr: "" };
  assert.equal((await docsOnly("base", "head", renamed)).clean, false);
});
test("stack probe treats gh-stack exit 9 as disabled and probes REST", async () => {
  const calls: string[][] = [];
  const runner: CommandRunner = async (_command, args) => {
    calls.push(args);
    if (args[0] === "extension") return { ok: true, stdout: "gh-stack\n", stderr: "" };
    if (args[0] === "stack") return { ok: false, stdout: "", stderr: "not enabled", exitCode: 9 };
    if (args[0] === "repo") return { ok: true, stdout: JSON.stringify({ nameWithOwner: "acme/repo" }), stderr: "" };
    return { ok: true, stdout: "[]", stderr: "" };
  };
  assert.deepEqual(await probe(runner), { tier: "T2", extension: true, feature: true });
  assert.ok(calls.some((args) => args.join(" ") === "stack view --json"));
});
