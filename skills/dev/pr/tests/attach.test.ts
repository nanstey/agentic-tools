import test, { after } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attach } from "../scripts/body.ts";
import type { Snapshot } from "../scripts/resolve.ts";
import type { CommandRunner } from "../scripts/runner.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-attach-state-"));
const oldStateHome = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = stateHome;
after(() => { if (oldStateHome === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldStateHome; rmSync(stateHome, { recursive: true, force: true }); });
const pr = { repo: "acme/repo", number: 7 } as Snapshot;
const runId = "run-7";
function setup() {
  const root = mkdtempSync(join(tmpdir(), "pr-attach-"));
  const cap = join(root, "capture", "repo", "branch");
  mkdirSync(cap, { recursive: true, mode: 0o700 });
  for (const dir of [root, join(root, "capture"), join(root, "capture", "repo"), cap]) chmodSync(dir, 0o700);
  const asset = join(cap, "screen.png");
  writeFileSync(asset, "png data");
  const bodyPath = join(root, "body.md");
  writeFileSync(bodyPath, `## Screenshots\n\n![Current UI](${asset})\n`);
  let body = readFileSync(bodyPath, "utf8");
  let attached = false;
  const calls: string[][] = [];
  const runner: CommandRunner = async (command, args) => {
    calls.push([command, ...args]);
    if (command === "bash") return { ok: true, stdout: cap, stderr: "" };
    if (command === "file") return { ok: true, stdout: "image/png\n", stderr: "" };
    if (command === "wc") return { ok: true, stdout: "8\n", stderr: "" };
    if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, stdout: process.cwd(), stderr: "" };
    if (command === "git") return { ok: false, stdout: "", stderr: "error: pathspec did not match any files" };
    if (command === "gh" && args[0] === "--version") return { ok: true, stdout: "gh version 2.99.0\n", stderr: "" };
    if (command === "gh" && args[0] === "auth") return { ok: true, stdout: "Logged in", stderr: "" };
    if (command === "gh" && args[0] === "repo") return { ok: true, stdout: JSON.stringify({ viewerPermission: "WRITE", url: "https://github.com/acme/repo" }), stderr: "" };
    if (command === "gh" && args[0] === "pr" && args[1] === "edit") {
      if (args.includes("--attach")) {
        attached = true;
        body = body.replace(asset, "https://github.com/user-attachments/assets/asset-7");
      }
      return { ok: true, stdout: "", stderr: "" };
    }
    if (command === "gh" && args[0] === "pr" && args[1] === "view") return { ok: true, stdout: JSON.stringify({ body: attached ? body : readFileSync(bodyPath, "utf8") }), stderr: "" };
    return { ok: true, stdout: "", stderr: "" };
  };
  return { root, cap, asset, bodyPath, calls, runner };
}

test("attach uploads validated off-tree artifacts and verifies hosted body reference", async () => {
  const f = setup();
  try {
    const result = await attach(pr, runId, ["--run", runId, "--file", f.bodyPath, "--cap", f.cap, "--capture-skill-dir", f.root], f.runner) as { attached: string[]; body: string };
    assert.deepEqual(result.attached, [f.asset]);
    assert.match(result.body, /https:\/\/github\.com\/user-attachments\/assets\/asset-7/);
    assert.equal(f.calls.filter((call) => call[0] === "gh" && call.includes("--attach")).length, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("attach returns a pending handoff when a non-safety preflight gate fails", async () => {
  const f = setup();
  const runner: CommandRunner = async (command, args, env, cwd, timeout) => {
    if (command === "gh" && args[0] === "auth") return { ok: false, stdout: "", stderr: "not logged in" };
    return f.runner(command, args, env, cwd, timeout);
  };
  try {
    const result = await attach(pr, runId, ["--run", runId, "--file", f.bodyPath, "--cap", f.cap], runner) as { pending: boolean; paths: string[] };
    assert.equal(result.pending, true);
    assert.deepEqual(result.paths, [f.asset]);
    assert.equal(f.calls.some((call) => call.includes("--attach")), false);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("attach uses the body REST fallback after projectCards and confirms references", async () => {
  const f = setup();
  let rereadCount = 0;
  const runner: CommandRunner = async (command, args, env, cwd, timeout) => {
    if (command === "gh" && args[0] === "pr" && args[1] === "edit") return { ok: false, stdout: "", stderr: "projectCards is not supported" };
    if (command === "gh" && args[0] === "api" && args[1]?.startsWith("repos/")) return { ok: true, stdout: "{}", stderr: "" };
    if (command === "gh" && args[0] === "pr" && args[1] === "view") { rereadCount++; return { ok: true, stdout: JSON.stringify({ body: readFileSync(f.bodyPath, "utf8") }), stderr: "" }; }
    return f.runner(command, args, env, cwd, timeout);
  };
  try {
    const result = await attach(pr, runId, ["--run", runId, "--file", f.bodyPath, "--cap", f.cap, "--capture-skill-dir", f.root], runner) as { pending: boolean; paths: string[] };
    assert.equal(result.pending, true);
    assert.deepEqual(result.paths, [f.asset]);
    assert.equal(rereadCount, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("attach blocks API failures without retrying the native edit", async () => {
  const f = setup();
  const runner: CommandRunner = async (command, args, env, cwd, timeout) => {
    if (command === "gh" && args[0] === "pr" && args[1] === "edit") return { ok: false, stdout: "", stderr: "API unavailable" };
    return f.runner(command, args, env, cwd, timeout);
  };
  try {
    await assert.rejects(() => attach(pr, runId, ["--run", runId, "--file", f.bodyPath, "--cap", f.cap, "--capture-skill-dir", f.root], runner), /blocked: native attachment partial result/);
    assert.equal(f.calls.filter((call) => call[0] === "gh" && call.includes("--attach")).length, 0);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
