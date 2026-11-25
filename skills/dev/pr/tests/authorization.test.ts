import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { authorize, renderAuthorizationTable } from "../scripts/authorize.ts";

test("A7 SKILL.md authorization table matches the executable authorization table", () => {
  const skill = readFileSync(resolve(process.cwd(), "SKILL.md"), "utf8");
  const section = skill.split("## Authorization")[1]?.split("\n## ")[0];
  assert.ok(section, "SKILL.md is missing ## Authorization table");
  const table = section.split("\n").filter((line) => line.startsWith("|"));
  assert.equal(table.join("\n"), renderAuthorizationTable());
});

test("lifecycle is own-PR only and never includes merge", () => {
  const expected = ["create-pr", "convert-draft", "convert-ready", "rerun-check", "rerequest", "attach", "edit-body", "push", "resolve-threads", "react"];
  assert.deepEqual(authorize("lifecycle", "none", "own"), expected);
  assert.deepEqual(authorize("lifecycle", "force", "own"), expected);
  assert.deepEqual(authorize("lifecycle", "none", "other"), ["react"]);
  assert.deepEqual(authorize("lifecycle", "none", "fork"), ["react"]);
  assert.ok(!authorize("lifecycle", "force", "own").includes("merge"));
  assert.ok(authorize("automerge", "none", "own").includes("merge"));
});

test("content-changing own-PR actions require draft conversion", () => {
  for (const action of ["push", "description", "screenshots", "rebase", "restack", "split", "stack", "ci", "comments"] as const) {
    assert.ok(authorize(action, action === "comments" ? "none" : "none", "own").includes("convert-draft"), action);
  }
  assert.ok(authorize("review", "fix", "own").includes("convert-draft"));
});

test("review publication and reactions are allowed on other and fork PRs", () => {
  for (const owner of ["other", "fork"] as const) {
    assert.deepEqual(authorize("review", "none", owner), ["post-review", "react"]);
    assert.deepEqual(authorize("review", "comment", owner), ["post-review", "react"]);
  }
});

test("stack never mutates another author's PR", () => {
  assert.deepEqual(authorize("stack", "none", "other"), []);
  assert.deepEqual(authorize("stack", "none", "fork"), []);
});
