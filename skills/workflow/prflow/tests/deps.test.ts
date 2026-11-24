import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("deletes a local branch only at the checked commit and when no worktree has it", async () => {
    const deps = realDeps();
    git("checkout", "-q", "-B", "main");
    git("branch", "gone");
    git("branch", "moved");
    git("branch", "busy");
    const info = await deps.branchInfo(dir);
    assert.ok(info);
    assert.equal(info.branch, git("symbolic-ref", "--short", "HEAD"));
    const gitDir = info.gitDir;
    const wt = join(dir, "..", `${dir.split("/").at(-1)}-wt`);
    git("worktree", "add", "-q", wt, "busy");
    after(() => rmSync(wt, { recursive: true, force: true }));
    const sha = info.sha;
    assert.equal((await deps.deleteBranch(gitDir, "gone", sha)).ok, true);
    assert.equal(git("branch", "--list", "gone"), "");
    git("checkout", "-q", "moved");
    writeFileSync(join(dir, "a"), "3");
    git("commit", "-qam", "three");
    const moved = await deps.deleteBranch(gitDir, "moved", sha);
    assert.equal(moved.ok, false, "branch moved since the check");
    assert.notEqual(git("branch", "--list", "moved"), "");
    const busy = await deps.deleteBranch(gitDir, "busy", sha);
    assert.match(busy.stderr, /still checked out/);
    assert.notEqual(git("branch", "--list", "busy"), "");
    git("checkout", "-q", "--detach");
    assert.equal((await deps.branchInfo(dir))?.branch, null);
  });


});

describe("review worktree creation environment", () => {
  it("runs orca-ide worktree create without the caller's terminal, chat, bot, or workspace identity", async () => {
    const bin = mkdtempSync(join(tmpdir(), "prflow-orca-"));
    const dump = join(bin, "env.txt");
    writeFileSync(join(bin, "orca-ide"), `#!/bin/sh\nenv > ${dump}\necho "$@" >> ${dump}\necho '{"ok":true,"result":{"worktree":{"id":"r::/w/prflow-review-x-5","path":"/w/prflow-review-x-5"}}}'\n`);
    chmodSync(join(bin, "orca-ide"), 0o755);
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { PATH: `${bin}:${process.env.PATH}`, ORCA_TERMINAL_HANDLE: "term_bot", ORCA_AGENT_SESSION_ID: "bot-session", ORCA_WORKSPACE_ID: "folder:bot", ORCA_WORKTREE_ID: "folder:bot", ORCA_ENVIRONMENT: "local" });
      const r = await realDeps().createReviewWorktree("rid1", "x-5", 5);
      assert.equal(r.ok, true, r.stderr);
      const seen = readFileSync(dump, "utf8");
      assert.doesNotMatch(seen, /ORCA_TERMINAL_HANDLE|ORCA_AGENT_SESSION_ID|ORCA_WORKSPACE_ID|ORCA_WORKTREE_ID/);
      assert.match(seen, /^ORCA_ENVIRONMENT=local$/m);
      assert.match(seen, /worktree create --repo id:rid1 --name prflow-review-x-5 --branch prflow-review\/x-5 --pr 5 --no-parent --setup run --json/);
      await assert.rejects(realDeps().unparentReviewWorktree("/w/prflow-review-x-5", "feature"), /requires a prflow-review branch/);
      await assert.rejects(realDeps().unparentReviewWorktree("/w/other", "prflow-review/x-5"), /not the allowed review worktree unparent call/);
      await assert.rejects(realDeps().linkReviewWorktree("/w/prflow-review-x-5", "feature", 5), /requires a prflow-review branch/);
      await assert.rejects(realDeps().linkReviewWorktree("/w/other", "prflow-review/x-5", 5), /not the allowed review worktree PR link/);
      assert.equal((await realDeps().linkReviewWorktree("/w/prflow-review-x-5", "prflow-review/x-5", 5)).ok, true);
      assert.match(readFileSync(dump, "utf8"), /worktree set --worktree path:\/w\/prflow-review-x-5 --pr 5 --json/);
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
      rmSync(bin, { recursive: true, force: true });
    }
  });
});
