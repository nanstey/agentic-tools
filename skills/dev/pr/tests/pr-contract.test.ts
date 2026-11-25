import test from "node:test";
import assert from "node:assert/strict";
import { authorize, AUTHORIZATION_TABLE, renderAuthorizationTable } from "../scripts/core/authorize.ts";
import { squashSubject } from "../scripts/phases/10-merge.ts";
import { parseTimeout } from "../scripts/phases/05-checks.ts";

test("authorization table includes every public action and renders stable markdown", () => {
  assert.ok(AUTHORIZATION_TABLE.lifecycle);
  assert.ok(AUTHORIZATION_TABLE.automerge);
  assert.equal(authorize("merge", "none", "own").includes("merge"), true);
  assert.match(renderAuthorizationTable(), /^\| Action \| Mode \| Own \| Other \| Fork \|/);
});
test("squash subject includes the PR number exactly once", () => {
  assert.equal(squashSubject("Feature (#7)", 7), "Feature (#7)");
  assert.equal(squashSubject("Feature", 7), "Feature (#7)");
});
test("check wait timeout defaults to 30 minutes and parses explicit units", () => {
  assert.equal(parseTimeout(undefined), 30 * 60_000);
  assert.equal(parseTimeout("30m"), 30 * 60_000);
  assert.equal(parseTimeout("2h"), 120 * 60_000);
  assert.throws(() => parseTimeout("soon"), /blocked:/);
});
