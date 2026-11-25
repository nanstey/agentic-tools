// Regressions found by running the lifecycle against real gh/git on PR #208.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guard } from "../scripts/guard.ts";
import type { Snapshot } from "../scripts/resolve.ts";
import type { CommandRunner } from "../scripts/runner.ts";

const scripts = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts");
const ok = (stdout = "") => ({ ok: true, stdout, stderr: "" });
const pr = { owner: "own", fork: false, headRefName: "feat/x", headRefOid: "aaa", url: "https://github.com/o/r/pull/1", repo: "o/r", number: 1 } as unknown as Snapshot;

test("gh repo view never receives a --repo flag (gh rejects it)", () => {
  for (const file of readdirSync(scripts).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(join(scripts, file), "utf8");
    assert.doesNotMatch(source, /"repo",\s*"view",\s*"--repo"/, file);
  }
});

function gitRunner(head: string, ancestor: boolean): CommandRunner {
  return async (_command, args) => {
    if (args[0] === "branch") return ok("feat/x");
    if (args[0] === "rev-parse") return ok(head);
    if (args[0] === "status") return ok("");
    if (args[0] === "merge-base") return ancestor ? ok() : { ok: false, stdout: "", stderr: "" };
    return ok();
  };
}

test("guard allowing ahead accepts local commits on top of the PR head", async () => {
  assert.deepEqual(await guard(pr, gitRunner("bbb", true), true), { guard: "passed", pr: pr.url });
});

test("guard allowing ahead still refuses a HEAD that does not contain the PR head", async () => {
  await assert.rejects(guard(pr, gitRunner("bbb", false), true), /blocked: working tree guard/);
});

test("strict guard refuses local commits ahead of the PR head", async () => {
  await assert.rejects(guard(pr, gitRunner("bbb", true)), /blocked: working tree guard/);
});

test("force-with-lease guard permits rewritten history but keeps other guard checks", async () => {
  assert.deepEqual(await guard(pr, gitRunner("rewritten", false), false, false), { guard: "passed", pr: pr.url });
  await assert.rejects(guard({ ...pr, owner: "other" }, gitRunner("rewritten", false), false, false), /blocked: working tree guard/);
});

test("a fresh head with a null statusCheckRollup reads as zero observed checks", async () => {
  const { pageAt } = await import("../scripts/resolve.ts");
  const pr = { commits: { nodes: [{ commit: { statusCheckRollup: null } }] } };
  assert.deepEqual(pageAt(pr, ["commits", "nodes", "0", "commit", "statusCheckRollup", "contexts"]).nodes, []);
  assert.throws(() => pageAt({ reviews: null }, ["reviews"]), /blocked: PR pagination/);
});

test("checks wait --required stops at the next flag, so --timeout is not a check name", async () => {
  const { list } = await import("../scripts/pr.ts");
  const args = ["wait", "208", "--required", "installer", "pi package patches", "--timeout", "15m"];
  assert.deepEqual(list(args, "--required"), ["installer", "pi package patches"]);
});
