import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { realDeps } from "../scripts/deps.ts";

const dir = mkdtempSync(join(tmpdir(), "prflow-git-"));
after(() => rmSync(dir, { recursive: true, force: true }));
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" }).trim();

describe("real git checks", () => {
  it("counts unpushed commits unless HEAD is the PR head or an ancestor of it", async () => {
    git("init", "-q");
    writeFileSync(join(dir, "a"), "1");
    git("add", "a");
    git("commit", "-qm", "one");
    const first = git("rev-parse", "HEAD");
    writeFileSync(join(dir, "a"), "2");
    git("commit", "-qam", "two");
    const second = git("rev-parse", "HEAD");
    const deps = realDeps();
    assert.equal(await deps.gitUnpushed(dir, null), 2, "no remote: every commit is unpushed");
    assert.equal(await deps.gitUnpushed(dir, second), 0, "HEAD is the PR head");
    git("checkout", "-q", first);
    assert.equal(await deps.gitUnpushed(dir, second), 0, "HEAD is an ancestor of the PR head");
    git("checkout", "-q", second);
    assert.equal(await deps.gitUnpushed(dir, first), 2, "HEAD is ahead of the PR head");
    assert.equal(await deps.gitUnpushed(dir, "0".repeat(40)), 2, "unknown PR head object");
    assert.equal(await deps.gitUnpushed(join(dir, "missing"), null), null);
    assert.equal(await deps.gitDirty(dir), 0);
    writeFileSync(join(dir, "untracked"), "x");
    assert.equal(await deps.gitDirty(dir), 1, "untracked files count as dirty");
  });

  it("refuses a malformed rerun or archive before running anything", async () => {
    const deps = realDeps();
    await assert.rejects(deps.rerunFailed("u", "Acme/x", "42 --debug"), /not the allowed rerun call/);
    await assert.rejects(deps.rerunFailed("u", "Acme", "42"), /not the allowed rerun call/);
    await assert.rejects(deps.archiveWorktree("relative/path"), /not the allowed archive call/);
    await assert.rejects(deps.archiveWorktree("/w/../etc"), /not the allowed archive call/);
  });
});
