import test from "node:test";
import assert from "node:assert/strict";
import { mergePrPage } from "../scripts/resolve.ts";

const page = (nodes: string[], hasNextPage: boolean, endCursor: string | null) => ({ nodes, pageInfo: { hasNextPage, endCursor } });
function pullRequest(commentPage: ReturnType<typeof page>, reviewPage: ReturnType<typeof page>) {
  return { comments: commentPage, reviews: reviewPage, reviewThreads: page([], false, null), commits: { nodes: [{ commit: { statusCheckRollup: { contexts: page([], false, null) } } }] } };
}
test("pagination does not append collections that finished on an earlier page", () => {
  const merged = structuredClone(pullRequest(page(["comment"], false, null), page(["review-1"], true, "reviews-next")));
  const cursors: Record<string, string> = {};
  assert.equal(mergePrPage(merged, merged, cursors, true), true);
  const next = pullRequest(page(["duplicate-comment"], false, null), page(["review-2"], false, null));
  assert.equal(mergePrPage(next, merged, cursors, false), false);
  assert.deepEqual(merged.comments.nodes, ["comment"]);
  assert.deepEqual(merged.reviews.nodes, ["review-1", "review-2"]);
});
