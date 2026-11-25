import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collapseCheck, link, probe } from "../scripts/stack.ts";
import type { CommandRunner } from "../scripts/runner.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-stack-state-"));
process.env.XDG_STATE_HOME = stateHome;
test.after(() => rmSync(stateHome, { recursive: true, force: true }));

const ok = (stdout = "") => ({ ok: true, stdout, stderr: "" });
const fail = (stderr: string, exitCode = 1) => ({ ok: false, stdout: "", stderr, exitCode });

test("stack probe identifies T1, configures unset preflight only, and avoids TUI commands", async () => {
  const calls: string[][] = [];
  const configured = new Set(["rerere.enabled"]);
  const runner: CommandRunner = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return ok(process.cwd());
    if (command === "gh" && args[0] === "extension") return ok("github/gh-stack\n");
    if (command === "gh" && args[0] === "repo") return ok('{"nameWithOwner":"acme/repo"}');
    if (command === "gh" && args[0] === "api") return ok("[]");
    if (command === "gh" && args[0] === "stack") return ok("{}");
    if (command === "git" && args[0] === "config" && args[1] === "--get") return configured.has(args[2]!) ? ok("true") : fail("unset", 1);
    if (command === "git" && args[0] === "config") { configured.add(args[1]!); return ok(); }
    if (command === "git" && args[0] === "remote") return ok("origin\nbackup\n");
    throw new Error(`unexpected ${command} ${args.join(" ")}`);
  };
  assert.deepEqual(await probe(runner), { tier: "T1", extension: true, feature: true });
  assert.ok(calls.some((args) => args.join(" ") === "git config remote.pushDefault origin"));
  assert.ok(!calls.some((args) => /\b(switch|modify)\b/.test(args.join(" ")) || (args.includes("submit") && !args.includes("--auto"))));
});

test("stack probe --repo bypasses gh repo auto-detection for host aliases", async () => {
  const calls: string[][] = [];
  const runner: CommandRunner = async (_command, args) => { calls.push(args); if (args[0] === "extension") return ok(""); if (args[0] === "api") return ok("[]"); throw new Error("repo autodetection should not run"); };
  assert.deepEqual(await probe(runner, "acme/repo"), { tier: "T2", extension: false, feature: true });
  assert.ok(!calls.some((args) => args[0] === "repo"));
});
test("stack probe returns T3 when REST capability is absent", async () => {
  const runner: CommandRunner = async (_command, args) => args[0] === "extension" ? ok("") : args[0] === "repo" ? ok('{"nameWithOwner":"acme/repo"}') : fail("HTTP 404 not found", 1);
  assert.deepEqual(await probe(runner), { tier: "T3", extension: false, feature: false });
});

test("stack probe blocks on REST API failure and maps gh-stack exit codes to recovery actions", async () => {
  const apiFailure: CommandRunner = async (_command, args) => args[0] === "extension" ? ok("") : args[0] === "repo" ? ok('{"nameWithOwner":"acme/repo"}') : fail("HTTP 500", 1);
  await assert.rejects(probe(apiFailure), /blocked: stack capability/);
  const cliFailure: CommandRunner = async (_command, args) => args[0] === "extension" ? ok("gh-stack") : args[0] === "repo" ? ok('{"nameWithOwner":"acme/repo"}') : args[0] === "api" ? ok("[]") : fail("locked", 8);
  await assert.rejects(probe(cliFailure), /unblock requires: wait for the lock to clear, then retry/);
});

test("stack link verifies the base chain before creating a bottom-to-top stack", async () => {
  let call = "";
  const runner: CommandRunner = async (_command, args) => { call = args.join(" "); if (args[0] === "api" && args[1]?.includes("/pulls/")) { const n = args[1].split("/").at(-1); return ok(JSON.stringify({ head: { sha: n === "4" ? "h4" : "h5" }, base: { sha: n === "4" ? "b4" : "h4" } })); } return ok('{"number":12}'); };
  assert.deepEqual(await link("acme/repo", ["4", "5"], runner), { number: 12 });
  assert.equal(call, "api repos/acme/repo/stacks -X POST -F pull_requests[]=4 -F pull_requests[]=5");
});

test("stack link blocks invalid input and surfaces API failures", async () => {
  await assert.rejects(link("bad", ["4"], async () => ok()), /blocked: stack link/);
  await assert.rejects(link("acme/repo", ["4", "5"], async () => fail("HTTP 403")), /blocked: gh API/);
});

test("stack collapse-check allows linear clean stacks, blocks unmet preconditions, and fails closed on git errors", async () => {
  const runner: CommandRunner = async (_command, args) => args[0] === "rev-parse" && args[1] === "--show-toplevel" ? ok(process.cwd()) : args[0] === "merge-base" ? ok() : args[0] === "status" ? ok("") : fail("fatal: Needed a single revision");
  assert.deepEqual(await collapseCheck(["aaaaaaa", "bbbbbbb"], runner), { collapseAllowed: true, heads: ["aaaaaaa", "bbbbbbb"] });
  await assert.rejects(collapseCheck(["aaaaaaa"], runner), /blocked: stack collapse/);
  await assert.rejects(collapseCheck(["aaaaaaa", "bbbbbbb"], async (_command, args) => args[0] === "rev-parse" && args[1] === "--show-toplevel" ? ok(process.cwd()) : args[0] === "merge-base" ? fail("git unavailable") : ok()), /blocked: stack ancestry/);
  const apiFailure = async (_command: string, args: string[]) => args[0] === "rev-parse" && args[1] === "--show-toplevel" ? ok(process.cwd()) : args[0] === "merge-base" ? ok() : fail("git API failure");
  await assert.rejects(collapseCheck(["aaaaaaa", "bbbbbbb"], apiFailure), /blocked: stack collapse/);
});
