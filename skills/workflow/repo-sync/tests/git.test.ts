import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHILD_TIMEOUT_MS, gitEnv, gitLimits, MERGE_TIMEOUT_MS } from "../scripts/deps.ts";
import { gitArgs, safeBranch, safeSha } from "../scripts/git.ts";
import { SHA_A, SHA_B } from "./fixtures.ts";

describe("git input builders", () => {
  it("builds status without optional index locks and reads origin URL", () => {
    assert.deepEqual(gitArgs.status(), ["--no-optional-locks", "status", "--porcelain"]);
    assert.deepEqual(gitArgs.originUrl(), ["remote", "get-url", "origin"]);
  });

  it("accepts safe branches and full object names", () => {
    assert.equal(safeBranch("main"), true);
    assert.equal(safeBranch("release/v2"), true);
    assert.equal(safeSha(SHA_A), true);
    assert.equal(safeSha("c".repeat(64)), true);
  });

  it("rejects unsafe branches and SHAs at builders", () => {
    for (const b of ["-x", "a..b", "a b", "HEAD"]) {
      assert.throws(() => gitArgs.fetch(b), new RegExp(`unsafe branch name: ${b}`));
      assert.throws(() => gitArgs.merge(b));
      assert.throws(() => gitArgs.count(b));
    }
    for (const bad of ["HEAD", "a".repeat(39), "a".repeat(40) + "x"]) {
      assert.throws(() => gitArgs.log(SHA_A, bad));
      assert.throws(() => gitArgs.diff(bad, SHA_B));
    }
  });
});

describe("remote-tracking refs and git child limits", () => {
  it("spells remote-tracking refs in full so tags or branches named origin/<b> cannot shadow them", () => {
    assert.deepEqual(gitArgs.merge("main"), ["merge", "--ff-only", "--no-overwrite-ignore", "refs/remotes/origin/main"]);
    assert.deepEqual(gitArgs.count("main"), ["rev-list", "--left-right", "--count", "HEAD...refs/remotes/origin/main"]);
    assert.deepEqual(gitArgs.originHead(), ["rev-parse", "--abbrev-ref", "refs/remotes/origin/HEAD"]);
    assert.deepEqual(gitArgs.indexLock(), ["rev-parse", "--git-path", "index.lock"]);
  });

  it("never SIGKILLs a merge: it gets a long limit and SIGTERM so git can remove its lock", () => {
    assert.deepEqual(gitLimits(gitArgs.merge("main")), { timeoutMs: MERGE_TIMEOUT_MS, signal: "SIGTERM" });
    assert.ok(MERGE_TIMEOUT_MS >= 30 * 60_000);
    for (const args of [gitArgs.fetch("main"), gitArgs.status(), gitArgs.count("main")]) assert.deepEqual(gitLimits(args), { timeoutMs: CHILD_TIMEOUT_MS, signal: "SIGKILL" });
  });

  it("drops git location variables a hook would set, and never prompts", () => {
    const env = gitEnv({ PATH: "/bin", GIT_DIR: "/x/.git", GIT_WORK_TREE: "/x", GIT_INDEX_FILE: "/x/i", GIT_COMMON_DIR: "/x" }, { GH_TOKEN: "t" });
    assert.deepEqual(env, { PATH: "/bin", GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1", LC_ALL: "C", GH_TOKEN: "t" });
  });
});
