import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classify,
  classifyAuthored,
  classifyReviewRequest,
  classifyWorktree,
  jobId,
  legacyLine,
  legacyTriggers,
  version,
} from "../scripts/core/classify.ts";
import { renderReport } from "../scripts/core/report.ts";
import type { PrSnapshot, Role, WorktreeItem } from "../scripts/core/types.ts";
import { parsePr } from "../scripts/adapters/gh.ts";
import { AFTER, alice, CASES, comment, HEAD, LATER, ME, me, ok, prResponse, review, run, type PrSpec } from "./fixtures.ts";

function snap(spec: PrSpec, role: Role = "author", number = 1): PrSnapshot {
  const p = parsePr(JSON.stringify(prResponse(spec)), "Acme/widgets", number, role);
  assert.ok(p);
  return p;
}

describe("author classifier fixtures", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const pr = snap(c.pr);
      const lines = legacyTriggers(pr, ME).map((t) => legacyLine(pr, t));
      assert.deepEqual(lines, c.lines.map((l) => `Acme/widgets#1@${HEAD.slice(0, 8)}:${l}`));
      assert.equal(classifyAuthored(pr, ME).kind, c.kind);
    });
  }

  it("ignores own pending review instead of crashing (legacy crashed)", () => {
    const pr = snap({ decision: null, comments: [comment(alice, AFTER)], reviews: [review(me, "PENDING", null)] });
    assert.deepEqual(legacyTriggers(pr, ME), [{ kind: "comments", detail: AFTER }]);
  });

  it("reports every trigger but picks the highest-priority kind", () => {
    const c = classifyAuthored(snap({ comments: [comment(alice, AFTER)] }), ME);
    assert.equal(c.kind, "merge-ready");
    assert.deepEqual(c.triggers.map((t) => t.kind), ["comments", "merge"]);
    assert.equal(c.owner, "you");
    assert.match(c.nextAction, /never merges/);
    assert.match(c.status, /also: comments/);
  });

  it("describes why a PR is waiting", () => {
    assert.match(classify(snap({ checks: [run("a", "IN_PROGRESS", null)] }), ME).status, /^checks pending/);
    assert.match(classify(snap({ decision: "REVIEW_REQUIRED" }), ME).status, /^approval outstanding/);
  });
});

describe("version", () => {
  it("starts with head8 and changes with a new comment on the same head", () => {
    const a = version(snap({}));
    const b = version(snap({ comments: [comment(alice, AFTER)] }));
    assert.match(a, /^c0ffee11-[0-9a-f]{8}$/);
    assert.notEqual(a, b);
    assert.equal(a, version(snap({})));
  });

  it("changes when a thread is resolved", () => {
    const t = (r: boolean) => ({ isResolved: r, comments: { nodes: [comment(alice, AFTER)] } });
    assert.notEqual(version(snap({ threads: [t(false)] })), version(snap({ threads: [t(true)] })));
  });
});

describe("jobId", () => {
  it("takes the last URL segment, else the name", () => {
    assert.equal(jobId("https://github.com/o/r/actions/runs/9/job/42", "x"), "42");
    assert.equal(jobId(null, "x"), "x");
    assert.equal(jobId("", "x"), "x");
    assert.equal(jobId("no-slash", "x"), "no-slash");
  });
});

describe("review-requested classifier", () => {
  const rq = (spec: PrSpec) => classifyReviewRequest(snap({ decision: null, ...spec }, "reviewer"), ME);

  it("requests a review when required checks finished", () => {
    const c = rq({ checks: [ok("build", true), run("slow", "IN_PROGRESS", null, null, false)] });
    assert.equal(c.kind, "review-requested");
    assert.equal(c.owner, "Pi reviewer");
    assert.match(c.nextAction, /Noel approves before posting/);
  });

  it("waits while a required check runs", () => {
    const c = rq({ checks: [run("build", "IN_PROGRESS", null, null, true)] });
    assert.equal(c.kind, "waiting");
    assert.match(c.status, /required checks pending/);
  });

  it("treats a failed required check as finished", () => {
    assert.equal(rq({ checks: [run("build", "COMPLETED", "FAILURE", null, true)] }).kind, "review-requested");
  });

  it("waits on drafts", () => {
    assert.equal(rq({ isDraft: true }).kind, "waiting");
  });

  it("waits when the head was already reviewed", () => {
    assert.equal(rq({ reviews: [review(me, "COMMENTED", AFTER, "", HEAD)] }).kind, "waiting");
  });

  it("asks again after a new head", () => {
    assert.equal(rq({ reviews: [review(me, "APPROVED", AFTER, "", "0ld")] }).kind, "review-requested");
  });

  it("does not count a pending own review or someone else's review", () => {
    assert.equal(rq({ reviews: [review(me, "PENDING", null, "", HEAD), review(alice, "APPROVED", LATER, "", HEAD)] }).kind, "review-requested");
  });

  it("classify routes by role", () => {
    assert.equal(classify(snap({ decision: null }, "reviewer"), ME).kind, "review-requested");
    assert.equal(classify(snap({ decision: null }, "author"), ME).kind, "waiting");
  });
});

describe("worktree classifier", () => {
  const wt = (state: string, dirtyFiles: number | null): WorktreeItem => ({
    path: "/w/x",
    branch: "x",
    repo: "Acme/widgets",
    pr: { number: 7, state, title: "t", url: "u" },
    dirtyFiles,
  });

  it("ignores open PRs", () => assert.equal(classifyWorktree(wt("OPEN", 0)), null));

  it("archives clean worktrees of merged or closed PRs", () => {
    for (const s of ["MERGED", "CLOSED"]) {
      const c = classifyWorktree(wt(s, 0));
      assert.equal(c?.kind, "cleanup");
      assert.equal(c?.owner, "prflow");
      assert.equal(c?.nextAction, "archive worktree");
    }
  });

  it("hands dirty or unknown worktrees to Noel", () => {
    for (const d of [3, null]) {
      const c = classifyWorktree(wt("MERGED", d));
      assert.equal(c?.owner, "you");
      assert.match(c?.nextAction ?? "", /uncommitted/);
    }
  });
});

describe("report", () => {
  it("groups most urgent first and omits empty groups", () => {
    const items = [
      classify(snap({ decision: "REVIEW_REQUIRED" }, "author", 3), ME),
      classify(snap({ checks: [run("t", "COMPLETED", "FAILURE")] }, "author", 2), ME),
      classify(snap({}, "author", 1), ME),
    ];
    const text = renderReport(items);
    const order = ["## Needs your decision (1)", "#1 ", "## Ready to act (1)", "#2 ", "## Blocked on others (1)", "#3 "];
    let at = -1;
    for (const s of order) {
      const i = text.indexOf(s);
      assert.ok(i > at, `${s} out of order in\n${text}`);
      at = i;
    }
    assert.ok(!text.includes("Cleanup"));
    assert.match(text, /\| owner: you$/m);
  });

  it("says so when there is nothing", () => assert.equal(renderReport([]), "Nothing to report."));
});
