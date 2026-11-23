import assert from "node:assert/strict";
import test from "node:test";
import { prDecision, type Pr } from "../task-status.ts";
import { openPrColumn } from "../../skills/workflow/prflow/scripts/core/worktree-status.ts";
import type { PrSnapshot } from "../../skills/workflow/prflow/scripts/core/types.ts";

const HEAD = "a".repeat(40);
const basePr: Pr = {
  number: 7, state: "OPEN", isDraft: false, mergedAt: null, reviewDecision: "APPROVED",
  mergeStateStatus: "CLEAN", headRefOid: HEAD, checks: [],
};
const baseSnapshot: PrSnapshot = {
  repo: "acme/widgets", number: 7, title: "test", url: "https://github.com/acme/widgets/pull/7",
  role: "author", account: "me", state: "OPEN", isDraft: false, headSha: HEAD,
  headCommittedDate: "", mergeStateStatus: "CLEAN", reviewDecision: "APPROVED", checks: [],
  comments: [], reviews: [], threads: [], reviewRequests: [],
};

const rows: { name: string; task: Partial<Pr>; flow: Partial<PrSnapshot>; want: string }[] = [
  { name: "CLEAN with no review required", task: { reviewDecision: "", mergeStateStatus: "CLEAN" }, flow: { reviewDecision: "", mergeStateStatus: "CLEAN" }, want: "done" },
  { name: "HAS_HOOKS and approved", task: { mergeStateStatus: "HAS_HOOKS" }, flow: { mergeStateStatus: "HAS_HOOKS" }, want: "done" },
  { name: "cancelled check", task: { checks: ["cancelled"] }, flow: { checks: [{ typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "CANCELLED", url: null, isRequired: false }] }, want: "in-review" },
  { name: "unanswered feedback", task: { feedback: true }, flow: { role: "author", threads: [{ isResolved: false, comments: [{ at: "2026-01-01T00:00:00Z", author: { login: "reviewer", typename: "User" } }] }] }, want: "needs-attention" },
  { name: "failing check", task: { checks: ["fail"] }, flow: { checks: [{ typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "FAILURE", url: null, isRequired: false }] }, want: "needs-attention" },
  { name: "DIRTY", task: { mergeStateStatus: "DIRTY" }, flow: { mergeStateStatus: "DIRTY" }, want: "needs-attention" },
  { name: "CHANGES_REQUESTED", task: { reviewDecision: "CHANGES_REQUESTED" }, flow: { reviewDecision: "CHANGES_REQUESTED" }, want: "needs-attention" },
  { name: "pending checks", task: { checks: ["pending"] }, flow: { checks: [{ typename: "CheckRun", name: "ci", status: "IN_PROGRESS", conclusion: null, url: null, isRequired: false }] }, want: "in-review" },
];

test("prDecision and openPrColumn use the same shared board rules for O11 PR facts", () => {
  for (const row of rows) {
    const taskPr = { ...basePr, ...row.task };
    const flowPr = { ...baseSnapshot, ...row.flow };
    assert.equal(prDecision(taskPr, { dirty: false, head: HEAD }).state, row.want, `${row.name}: prDecision`);
    assert.equal(openPrColumn(flowPr)?.state, row.want, `${row.name}: openPrColumn`);
  }
});

test("CANCELLED is distinct from failure in shared check parsing", async () => {
  const { checkState } = await import("../pr-state.ts");
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "CANCELLED" }), "cancelled");
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "FAILURE" }), "fail");
});
