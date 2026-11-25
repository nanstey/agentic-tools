import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rerunCancelled } from "../scripts/checks.ts";
import { identityOf, statePath } from "../scripts/run.ts";
import { readPrStore } from "../../../../lib/pr/store.ts";
import type { Snapshot } from "../scripts/resolve.ts";
import type { CommandRunner } from "../scripts/runner.ts";

const stateHome = mkdtempSync(join(tmpdir(), "pr-check-rerun-state-"));
const oldStateHome = process.env.XDG_STATE_HOME;
process.env.XDG_STATE_HOME = stateHome;
after(() => { if (oldStateHome === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = oldStateHome; rmSync(stateHome, { recursive: true, force: true }); });

test("rerunCancelled records each successful rerun before the next attempt", async () => {
  const pr = { repo: "acme/repo", number: 7, headRefOid: "a".repeat(40), checks: [
    { typename: "CheckRun", name: "first", status: "COMPLETED", conclusion: "CANCELLED", url: "https://github.com/acme/repo/actions/runs/1/job/101" },
    { typename: "CheckRun", name: "second", status: "COMPLETED", conclusion: "CANCELLED", url: "https://github.com/acme/repo/actions/runs/1/job/102" },
  ] } as Snapshot;
  let count = 0;
  const runner: CommandRunner = async (_command, args) => {
    if (args[0] === "run" && args[1] === "rerun") { if (++count === 2) return { ok: false, stdout: "", stderr: "rerun failed" }; return { ok: true, stdout: "", stderr: "" }; }
    throw new Error(`unexpected ${args.join(" ")}`);
  };
  await assert.rejects(() => rerunCancelled(pr, "run", runner), /rerun failed/);
  assert.deepEqual(readPrStore(statePath(pr), identityOf(pr)).cancelledCheckReruns[pr.headRefOid], ["101"]);
});
