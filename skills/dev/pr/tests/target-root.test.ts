import test from "node:test";
import assert from "node:assert/strict";
import { guard } from "../scripts/guard.ts";
import { targetRoot } from "../scripts/resolve.ts";
import { cleanup } from "../scripts/merge.ts";
import type { Snapshot } from "../scripts/resolve.ts";
import type { CommandRunner } from "../scripts/runner.ts";

const root = "/cwd/repository";
const pr = { owner: "own", fork: false, headRefName: "topic", headRefOid: "head", state: "MERGED", url: "https://github.com/acme/repo/pull/1" } as Snapshot;
function fakeRunner(calls: { command: string; args: string[]; cwd?: string }[]): CommandRunner {
  return async (command, args, _env, cwd) => {
    calls.push({ command, args, cwd });
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: root, stderr: "" };
    if (command === "git" && args[0] === "branch") return { ok: true, stdout: "topic\n", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") return { ok: true, stdout: "head\n", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--path-format=absolute") return { ok: true, stdout: args.at(-1) === "--git-dir" ? "/cwd/repository/.git" : "/cwd/common.git", stderr: "" };
    if (command === "orca-ide" && args[0] === "--version") return { ok: true, stdout: "1", stderr: "" };
    if (command === "orca-ide" && args[0] === "worktree" && args[1] === "current") return { ok: true, stdout: JSON.stringify({ result: { worktree: { id: "linked", isMainWorktree: false } } }), stderr: "" };
    return { ok: true, stdout: "", stderr: "" };
  };
}

test("git-dependent commands block outside a checkout instead of falling back to the script repository", async () => {
  const runner: CommandRunner = async () => ({ ok: false, stdout: "", stderr: "fatal: not a git repository" });
  await assert.rejects(() => targetRoot(runner), /blocked: git repository root.*invoke inside a git checkout/);
});

test("git and Orca operations use the caller's repository root, not the script directory", async () => {
  const calls: { command: string; args: string[]; cwd?: string }[] = [];
  const previous = process.env.ORCA_CLI_COMMAND; process.env.ORCA_CLI_COMMAND = "orca-ide";
  const runner = fakeRunner(calls);
  try { await guard(pr, runner); await cleanup(pr, runner); }
  finally { if (previous === undefined) delete process.env.ORCA_CLI_COMMAND; else process.env.ORCA_CLI_COMMAND = previous; }
  assert.ok(calls.some((call) => call.command === "git" && call.args[0] === "branch" && call.cwd === root));
  assert.ok(calls.some((call) => call.command === "orca-ide" && call.args[0] === "worktree" && call.cwd === root));
  assert.ok(calls.filter((call) => (call.command === "git" || call.command === "orca-ide") && !(call.command === "git" && call.args[0] === "rev-parse" && call.args[1] === "--show-toplevel")).every((call) => call.cwd === root));
});
