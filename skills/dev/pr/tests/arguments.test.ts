import test from "node:test";
import assert from "node:assert/strict";
import { parseArguments } from "../scripts/cli/args.ts";

test("merge options without a target keep proof text in flags", () => {
  const parsed = parseArguments(["--run", "X", "--no-required-checks", "--policy-proof", "T"]);
  assert.deepEqual(parsed.positionals, []);
  assert.deepEqual(parsed.flags.get("--run"), ["X"]);
  assert.deepEqual(parsed.flags.get("--no-required-checks"), ["true"]);
  assert.deepEqual(parsed.flags.get("--policy-proof"), ["T"]);
});

test("push force-with-lease without a target is a boolean flag", () => {
  const parsed = parseArguments(["--force-with-lease", "--run", "X"]);
  assert.deepEqual(parsed.positionals, []);
  assert.deepEqual(parsed.flags.get("--force-with-lease"), ["true"]);
  assert.deepEqual(parsed.flags.get("--run"), ["X"]);
});

test("reaction and thread targets stay positional while run and thread fields stay flags", () => {
  const reaction = parseArguments(["add", "208", "--run", "X"]);
  assert.deepEqual(reaction.positionals, ["add", "208"]);
  assert.deepEqual(reaction.flags.get("--run"), ["X"]);
  const reply = parseArguments(["reply", "208", "--run", "X", "--thread", "T", "--body-file", "F"]);
  assert.deepEqual(reply.positionals, ["reply", "208"]);
  assert.deepEqual(reply.flags.get("--run"), ["X"]);
  assert.deepEqual(reply.flags.get("--thread"), ["T"]);
  assert.deepEqual(reply.flags.get("--body-file"), ["F"]);
});
