import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classify,
  classifyAuthored,
  classifyReviewRequest,
  classifyWorktree,
  jobId,
  authorTriggers,
  version,
} from "../scripts/core/classify.ts";
import { renderReport } from "../scripts/core/report.ts";
import type { PrSnapshot, Role, WorktreeItem } from "../scripts/core/types.ts";
import { parsePr } from "../scripts/adapters/gh.ts";
import { AFTER, alice, bot, CASES, comment, HEAD, LATER, ME, me, ok, prResponse, review, run, thread, user, type PrSpec } from "./fixtures.ts";

function snap(spec: PrSpec, role: Role = "author", number = 1): PrSnapshot {
  const p = parsePr(JSON.stringify(prResponse(spec)), "Acme/widgets", number, role, ME);
  assert.ok(p);
  return p;
}

describe("author classifier fixtures", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const pr = snap(c.pr);
      const lines = authorTriggers(pr, ME).map((t) => (t.detail === undefined ? t.kind : `${t.kind}:${t.detail}`));
      assert.deepEqual(lines, c.lines);
      assert.equal(classifyAuthored(pr, ME).kind, c.kind);
    });
  }

  it("ignores own pending review instead of crashing (would crash a naive timestamp compare)", () => {
    const pr = snap({ decision: null, comments: [comment(alice, AFTER)], reviews: [review(me, "PENDING", null)] });
    assert.deepEqual(authorTriggers(pr, ME), [{ kind: "comments", detail: AFTER }]);
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
    assert.equal(c.owner, "agent reviewer");
    assert.match(c.nextAction, /you approve before posting/);
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

  it("marks a request another human already approved as low priority, without skipping it", () => {
    const bob = user("bob");
    const c = rq({ decision: "APPROVED", reviews: [review(alice, "APPROVED", AFTER, "lgtm", HEAD), review(bob, "APPROVED", LATER, "", HEAD)] });
    assert.equal(c.kind, "review-requested");
    assert.equal(c.lowPriority, true);
    assert.match(c.status, /^low priority \(already approved by alice, bob\); merge=/);
    assert.match(renderReport([c]), /review-requested: low priority \(already approved by alice, bob\)/);
  });

  it("is not low priority when changes are requested, the approval was superseded, or only a bot approved", () => {
    const bob = user("bob");
    assert.equal(rq({ decision: "CHANGES_REQUESTED", reviews: [review(alice, "APPROVED", AFTER, "", HEAD)] }).lowPriority, undefined);
    assert.equal(rq({ reviews: [review(alice, "APPROVED", AFTER, "", HEAD), review(bob, "CHANGES_REQUESTED", LATER, "fix", HEAD)] }).lowPriority, undefined);
    assert.equal(rq({ reviews: [review(alice, "APPROVED", AFTER, "", HEAD), review(alice, "DISMISSED", LATER, "", HEAD)] }).lowPriority, undefined);
    assert.equal(rq({ reviews: [review(alice, "APPROVED", AFTER, "", HEAD), review(alice, "COMMENTED", LATER, "one more", HEAD)] }).lowPriority, true);
    assert.equal(rq({ reviews: [review(bot("ci"), "APPROVED", AFTER, "", HEAD)] }).lowPriority, undefined);
  });

  it("sorts low-priority requests after the others", () => {
    const a = { ...rq({ reviews: [review(alice, "APPROVED", AFTER, "", HEAD)] }), number: 1, key: "Acme/widgets#1" };
    const b = { ...rq({}), number: 2, key: "Acme/widgets#2" };
    assert.match(renderReport([a, b]), /widgets#2 .*\n.*widgets#1 /);
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
    account: ME,
    pr: { number: 7, state, title: "t", url: "u", headSha: null },
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

  it("hands dirty or unknown worktrees to the user", () => {
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

describe("informational approvals (real case, anonymized)", () => {
  // Modelled on a real PR: two COMMENTED reviews asking for changes, the author's
  // reply, then an APPROVED review whose body only states a merge condition. The
  // only unresolved thread ends with the author's reply. The approval used to
  // trigger `comments`.
  const reviewer = user("reviewer-b");
  const spec: PrSpec = {
    head: "d21247b93c0cd7583fb7c38a0dbe333920159aea",
    committedDate: "2026-11-18T16:01:16Z",
    comments: [comment(bot("github-actions"), "2026-11-16T18:22:51Z"), comment(me, "2026-11-16T21:19:18Z"), comment(bot("github-actions"), "2026-11-18T16:15:29Z")],
    reviews: [
      review(reviewer, "COMMENTED", "2026-11-16T19:08:38Z", "> [!NOTE]\n> Written by an agent\n\n## Changes needed\n\n1. **Typed regions fail checkout** (inline).\n\n<!-- agent head=4e6dbbde -->", "4e6dbbdedb80e5db9659a33080d1705a56c74dba"),
      review(me, "COMMENTED", "2026-11-16T19:18:04Z", "", "36a65ddefae9be9ada0f2e4982cc7c7ea9918461"),
      review(reviewer, "COMMENTED", "2026-11-16T19:40:45Z", "## Changes needed\n\n- Still open: typed regions.", "36a65ddefae9be9ada0f2e4982cc7c7ea9918461"),
      review(
        reviewer,
        "APPROVED",
        "2026-11-18T19:11:14Z",
        "> [!NOTE]\n> Written by an agent\n\nLooks good to me. The docs and promo-code changes landed.\n\nMerge only after a release that includes #393 is in production.\n\nOptional: the sandbox still uses the old path.\n\n<!-- agent head=d21247b9 -->",
        "d21247b93c0cd7583fb7c38a0dbe333920159aea",
      ),
    ],
    threads: [thread(false, comment(reviewer, "2026-11-16T19:08:38Z"), comment(me, "2026-11-16T19:18:04Z"))],
  };

  it("is not a comments trigger; the PR is merge-ready with the approval body as a note", () => {
    const pr = snap(spec);
    assert.deepEqual(authorTriggers(pr, ME), [{ kind: "merge" }]);
    const c = classifyAuthored(pr, ME);
    assert.equal(c.kind, "merge-ready");
    assert.deepEqual(c.notes, [
      "approved by reviewer-b 2026-11-18 19:11Z: Looks good to me. The docs and promo-code changes landed. Merge only after a release that includes #393 is in production. Optional: the sandbox still uses the old path.",
    ]);
    assert.match(renderReport([c]), /merge-ready: .* \| note: approved by reviewer-b 2026-11-18 19:11Z: Looks good to me\./);
  });

  it("still counts an approval that asks for changes, and drops the note", () => {
    const pr = snap({ ...spec, reviews: [review(reviewer, "APPROVED", "2026-11-18T19:11:14Z", "Approving, but changes requested: rename x.")] });
    assert.deepEqual(authorTriggers(pr, ME), [{ kind: "comments", detail: "2026-11-18T19:11:14Z" }, { kind: "merge" }]);
    assert.equal(classifyAuthored(pr, ME).notes, undefined);
  });

  it("drops the note once the reviewer's latest review is not an approval", () => {
    const pr = snap({ ...spec, reviews: [...(spec.reviews ?? []), review(reviewer, "COMMENTED", "2026-11-18T20:00:00Z", "one more thing")] });
    assert.equal(classifyAuthored(pr, ME).notes, undefined);
  });
});
