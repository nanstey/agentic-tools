import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { realDeps } from "../scripts/deps.ts";
import { assertGit, gitArgs } from "../scripts/git.ts";

const A = "a".repeat(40);
const B = "b".repeat(40);

describe("git allowlist", () => {
  it("allows exactly the builder commands", () => {
    for (const args of [
      gitArgs.currentBranch(),
      gitArgs.originHead(),
      gitArgs.headSha(),
      gitArgs.verifyRemote("main"),
      gitArgs.status(),
      gitArgs.fetch("main"),
      gitArgs.fetch("release/v2"),
      gitArgs.merge("develop"),
      gitArgs.count("main"),
      gitArgs.log(A, B),
      gitArgs.diff(A, B),
    ])
      assert.doesNotThrow(() => assertGit(args), args.join(" "));
  });

  it("rejects everything else", () => {
    const denied: string[][] = [
      ["reset", "--hard", "origin/main"],
      ["checkout", "main"],
      ["switch", "main"],
      ["stash"],
      ["rebase", "origin/main"],
      ["push", "origin", "main"],
      ["pull"],
      ["pull", "--ff-only"],
      ["clean", "-fd"],
      ["branch", "-f", "main", "origin/main"],
      ["update-ref", "refs/heads/main", A],
      ["merge", "origin/main"],
      ["merge", "--ff-only", "upstream/main"],
      ["merge", "--ff-only", "main"],
      ["merge", "--ff-only", "origin/main", "--no-verify"],
      ["merge", "--no-ff", "origin/main"],
      ["fetch", "upstream", "main"],
      ["fetch", "origin", "main:main"],
      ["fetch", "origin", "+main"],
      ["fetch", "origin", "+refs/heads/*:refs/remotes/origin/*"],
      ["fetch", "--all"],
      ["fetch", "origin"],
      ["fetch", "-f", "origin", "main"],
      ["fetch", "origin", "-f"],
      ["fetch", "origin", "--upload-pack=touch /tmp/x"],
      ["fetch", "origin", "main", "other"],
      ["fetch", "origin", "HEAD"],
      ["fetch", "origin", "a..b"],
      ["fetch", "origin", "main.lock"],
      ["-c", "core.sshCommand=sh", "fetch", "origin", "main"],
      ["status"],
      ["status", "--porcelain", "--ignored"],
      ["rev-parse", "--verify", "--quiet", "refs/heads/main"],
      ["rev-list", "--left-right", "--count", "HEAD...upstream/main"],
      ["log", "--oneline", "--no-decorate", "-n", "10", "HEAD..origin/main"],
      ["log", "--oneline", "--no-decorate", "-n", "10", `${A}..${B}..${A}`],
      ["log", "-p", A],
      ["diff", "--name-only", "HEAD", B],
      ["diff", A, B],
      ["diff", "--name-only", A, B, "--output=/tmp/x"],
      [],
    ];
    for (const args of denied) assert.throws(() => assertGit(args), /is not allowed/, args.join(" "));
  });
});

describe("realDeps git", () => {
  const dir = mkdtempSync(join(tmpdir(), "repo-sync-deny-"));
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("throws before spawning a disallowed command", async () => {
    // A fake git on PATH would leave a marker file if it ever ran.
    const bin = join(dir, "bin");
    const marker = join(dir, "ran");
    mkdirSync(bin);
    writeFileSync(join(bin, "git"), `#!/bin/sh\ntouch '${marker}'\n`);
    chmodSync(join(bin, "git"), 0o755);
    const path = process.env.PATH;
    process.env.PATH = `${bin}:${path}`;
    try {
      const deps = realDeps();
      await assert.rejects(() => deps.git(dir, ["reset", "--hard"]), /is not allowed/);
      await assert.rejects(() => deps.git(dir, ["fetch", "origin", "main:main"]), /is not allowed/);
      assert.equal(existsSync(marker), false, "git never started");
      await deps.git(dir, gitArgs.status());
      assert.equal(existsSync(marker), true, "the fake git does run for allowed commands");
    } finally {
      process.env.PATH = path;
    }
  });
});
