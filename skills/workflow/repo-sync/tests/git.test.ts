import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gitArgs, safeBranch, safeSha } from "../scripts/git.ts";
import { SHA_A, SHA_B } from "./fixtures.ts";

describe("git input builders", () => {
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
