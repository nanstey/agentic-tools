import assert from "node:assert/strict";
import test from "node:test";
import { checkState } from "../pr-state.ts";
import { parsePr, PR_QUERY } from "../pr/github.ts";
import { summarizeChecks, unansweredFeedback } from "../pr/facts.ts";
import { plan, type ScanResult } from "../../skills/workflow/prflow/scripts/scan.ts";
import type { PrSnapshot } from "../pr/types.ts";

const snapshot: PrSnapshot = {
  repo: "Acme/widgets", number: 7, title: "fixture PR", url: "https://github.com/Acme/widgets/pull/7", role: "author", account: "octocat", state: "OPEN", isDraft: false,
  headSha: "abc123456789", headCommittedDate: "2026-01-01T00:00:00Z", mergeStateStatus: "CLEAN", reviewDecision: "APPROVED", checks: [], comments: [], reviews: [], threads: [], reviewRequests: [],
};

test("shared PR parser and check summary retain the prflow facts behavior", () => {
  assert.match(PR_QUERY, /reviewThreads/);
  assert.equal(checkState({ __typename: "CheckRun", status: "COMPLETED", conclusion: "CANCELLED" }), "cancelled");
  assert.deepEqual(summarizeChecks([
    { typename: "CheckRun", name: "build", status: "COMPLETED", conclusion: "FAILURE", url: "https://ci/jobs/42", isRequired: true },
    { typename: "StatusContext", name: "lint", state: "PENDING", url: null, isRequired: true },
  ]), { pending: true, failed: ["42"], cancelled: [], total: 2, requiredPending: 1 });
  assert.equal(unansweredFeedback({ ...snapshot, comments: [{ at: "2026-01-02T00:00:00Z", author: { login: "reviewer", typename: "User" } }] }, "octocat"), "2026-01-02T00:00:00Z");
  const missing = parsePr('{"data":{"repository":{"pullRequest":null}}}', snapshot.repo, snapshot.number, snapshot.role, snapshot.account);
  assert.equal(missing, null);
});

test("stored PR annotations do not change kind or dispatch decision", () => {
  const base: ScanResult = { prs: [snapshot], worktrees: [], errors: [] };
  const withRunState: ScanResult = { prs: [{ ...snapshot, runState: { packetVerdict: "pass", packetHead: snapshot.headSha, roundsUsed: 3, lastCompletion: "complete" } }], worktrees: [], errors: [] };
  const before = plan(base)[0]!;
  const after = plan(withRunState)[0]!;
  assert.equal(after.kind, before.kind);
  assert.equal(after.nextAction, before.nextAction);
  assert.equal(after.owner, before.owner);
  assert.deepEqual(after.runState, withRunState.prs[0]?.runState);
});
