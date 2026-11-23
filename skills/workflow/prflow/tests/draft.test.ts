import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assertReadOnly, assertReviewPost, reviewPostArgs } from "../scripts/adapters/gh.ts";
import { draftId, parseDraft, parseDraftId, reviewPayload } from "../scripts/core/draft.ts";
import type { PostDeps } from "../scripts/deps.ts";
import { draftPaths, writeMeta } from "../scripts/review.ts";
import { listDrafts, postDraft, renderDraftList, showDraft } from "../scripts/review-cmd.ts";
import type { Store } from "../scripts/store.ts";
import { DRAFT, HEAD, ME, prResponse, review, user } from "./fixtures.ts";
import { fail, okJson, T0, tempStore } from "./state-helpers.ts";

const ID = `Acme-x-5-${HEAD.slice(0, 8)}`;

describe("draft ids", () => {
  it("round-trips owner, repo, number, and head", () => {
    assert.equal(draftId("Acme/my-repo", 12, "d5f5da28"), "Acme-my-repo-12-d5f5da28");
    assert.deepEqual(parseDraftId("Acme-my-repo-12-d5f5da28"), { folder: "Acme-my-repo-12", head8: "d5f5da28" });
    for (const bad of ["Acme-x-5", "Acme-x-5-D5F5DA28", "../x-5-d5f5da28", "Acme/x-5-d5f5da28", "Acme-x-0-d5f5da28"]) assert.equal(parseDraftId(bad), null, bad);
    assert.throws(() => draftId("a b/x", 1, "d5f5da28"), /bad PR/);
    assert.throws(() => draftId("a/x/y", 1, "d5f5da28"), /bad PR/);
  });
});

describe("parseDraft", () => {
  it("reads the verdict, summary, and inline comments, and never the notes", () => {
    const d = parseDraft(DRAFT);
    assert.deepEqual(d.errors, []);
    assert.equal(d.verdict, "request-changes");
    assert.equal(d.summary, "One blocking finding: F1 in src/a.ts.");
    assert.deepEqual(d.comments, [
      { path: "src/a.ts", line: 12, startLine: null, body: "F1: this drops the error." },
      { path: "src/b.ts", line: 9, startLine: 3, body: "Nit: name this." },
    ]);
    assert.doesNotMatch(JSON.stringify(reviewPayload(d, "comment", HEAD)), /report mode/);
  });

  it("accepts None. for no inline comments", () => {
    const d = parseDraft(DRAFT.replace(/## Inline comments[\s\S]*?## Notes/, "## Inline comments\n\nNone.\n\n## Notes"));
    assert.deepEqual([d.errors, d.comments.length], [[], 0]);
  });

  it("reports every problem", () => {
    const d = parseDraft("Verdict: maybe\n\n## Inline comments\n\n### somewhere\n\nx\n\n### a.ts:9-3\n\ny\n\n### a.ts:4\n");
    assert.deepEqual(d.errors, [
      "first line must be <!-- prflow review draft v1 -->",
      "missing or unknown Verdict line (approve, request-changes, or comment)",
      "empty or missing ## Summary",
      'inline comment heading "somewhere" is not <path>:<line> or <path>:<start>-<end>',
      'inline comment heading "a.ts:9-3" is not <path>:<line> or <path>:<start>-<end>',
      "inline comment a.ts:4 has no text",
    ]);
  });

  it("builds the GitHub payload pinned to the commit, and refuses a broken draft", () => {
    assert.deepEqual(reviewPayload(parseDraft(DRAFT), "request-changes", HEAD), {
      commit_id: HEAD,
      event: "REQUEST_CHANGES",
      body: "One blocking finding: F1 in src/a.ts.",
      comments: [
        { path: "src/a.ts", line: 12, side: "RIGHT", body: "F1: this drops the error." },
        { path: "src/b.ts", line: 9, side: "RIGHT", start_line: 3, start_side: "RIGHT", body: "Nit: name this." },
      ],
    });
    assert.equal(reviewPayload(parseDraft(DRAFT), "approve", HEAD).event, "APPROVE");
    assert.throws(() => reviewPayload(parseDraft("x"), "comment", HEAD), /cannot be posted/);
    assert.throws(() => reviewPayload(parseDraft(DRAFT), "comment", "abc"), /bad commit id/);
  });
});

describe("review post allowlist", () => {
  const input = "/s/prflow/drafts/Acme-x-5/c0ffee11/post.json";
  it("allows exactly the review POST from a draft folder, and the read-only allowlist rejects it", () => {
    assert.doesNotThrow(() => assertReviewPost(reviewPostArgs("Acme/x", 5, input)));
    assert.throws(() => assertReadOnly(reviewPostArgs("Acme/x", 5, input)), /only gh api graphql is allowed/);
    for (const a of [
      reviewPostArgs("Acme/x", 5, "/tmp/post.json"),
      reviewPostArgs("Acme/x", 5, "/s/drafts/../../etc/post.json"),
      reviewPostArgs("Acme/x", 5, "drafts/a/post.json"),
      reviewPostArgs("Acme/x", 0, input),
      reviewPostArgs("Acme/x;rm", 5, input),
      ["api", "--method", "POST", "repos/Acme/x/pulls/5/merge", "--input", input],
      ["api", "--method", "PUT", "repos/Acme/x/pulls/5/reviews", "--input", input],
      ["api", "--method", "POST", "repos/Acme/x/pulls/5/reviews/1/events", "--input", input],
      ["api", "--method", "POST", "repos/Acme/x/issues/5/comments", "--input", input],
      [...reviewPostArgs("Acme/x", 5, input), "-f", "event=APPROVE"],
      ["pr", "review", "5", "--approve"],
    ])
      assert.throws(() => assertReviewPost(a), /prflow: gh .* is not the allowed review post/, a.join(" "));
  });
});

/** A saved draft with meta, in a temp store. */
function seed(s: Store, text: string | null = DRAFT) {
  const p = draftPaths(s.dir, "Acme/x", 5, HEAD.slice(0, 8));
  writeMeta(p, { id: ID, item: "Acme/x#5", repo: "Acme/x", number: 5, url: "https://github.com/Acme/x/pull/5", title: "T", headSha: HEAD, account: ME, dispatchId: 1, createdAt: new Date(T0).toISOString() });
  if (text !== null) writeFileSync(p.file, text);
  return p;
}

interface FakePost {
  pr: unknown;
  readFails?: string;
  postFails?: string;
  posts: string[][];
  reads: string[];
}

function postDeps(f: FakePost): PostDeps {
  return {
    now: () => T0,
    async gh(login, args) {
      assertReadOnly(args);
      f.reads.push(`${login} ${args[0]}`);
      return f.readFails ? fail(f.readFails) : okJson(f.pr);
    },
    async postReview(login, repo, number, input) {
      assertReviewPost(reviewPostArgs(repo, number, input));
      f.posts.push([login, repo, String(number), readFileSync(input, "utf8")]);
      return f.postFails ? fail(f.postFails) : okJson({ id: 99, html_url: "https://github.com/Acme/x/pull/5#pullrequestreview-99" });
    },
  };
}

describe("prflow review list and show", () => {
  it("lists drafts with their state and shows one with the post command", () => {
    const s = tempStore();
    assert.equal(renderDraftList(listDrafts(s)), "No review drafts.");
    seed(s, null);
    assert.match(renderDraftList(listDrafts(s)), new RegExp(`^- ${ID} \\| Acme/x#5 at c0ffee11 \\| not saved yet`));
    seed(s);
    assert.match(renderDraftList(listDrafts(s)), new RegExp(`^- ${ID} \\| Acme/x#5 at c0ffee11 \\| ready \\| verdict suggestion request-changes \\| 2 inline comment\\(s\\)`));
    const shown = showDraft(s, ID);
    assert.match(shown, new RegExp(`post with: prflow review post ${ID} --event request-changes --yes \\(default event: comment\\)`));
    assert.match(shown, /## Notes for Noel/);
    assert.throws(() => showDraft(s, "Acme-x-6-c0ffee11"), /not found/);
    assert.throws(() => showDraft(s, "../../x"), /bad draft id/);
  });
});

describe("prflow review post", () => {
  const fake = (over: Partial<FakePost> = {}): FakePost => ({ pr: prResponse({ requests: [ME], decision: null }), posts: [], reads: [], ...over });

  it("refuses without --yes and posts nothing", async () => {
    const s = tempStore();
    seed(s);
    const f = fake();
    const r = await postDraft(s, postDeps(f), ID, { event: "comment", yes: false });
    assert.equal(r.code, 1);
    assert.match(r.out, /^would post: COMMENT review of Acme\/x#5 at c0ffee11 with 2 inline comment\(s\), as octocat\nrefusing: add --yes/);
    assert.deepEqual([f.posts, f.reads], [[], []]);
  });

  it("posts once with --yes, as the draft's account, pinned to the reviewed commit, and logs review-posted", async () => {
    const s = tempStore();
    const p = seed(s);
    const f = fake();
    const r = await postDraft(s, postDeps(f), ID, { event: "request-changes", yes: true });
    assert.equal(r.code, 0, r.out);
    assert.equal(f.posts.length, 1);
    const [login, repo, n, body] = f.posts[0] ?? [];
    assert.deepEqual([login, repo, n], [ME, "Acme/x", "5"]);
    assert.deepEqual(JSON.parse(body ?? "{}"), JSON.parse(readFileSync(join(p.dir, "post.json"), "utf8")));
    assert.equal(JSON.parse(body ?? "{}").commit_id, HEAD);
    assert.equal(JSON.parse(body ?? "{}").event, "REQUEST_CHANGES");
    const ev = s.readEventsFrom(0).events;
    assert.deepEqual(ev.map((e) => e.type), ["review-posted"]);
    assert.match(ev[0]?.detail ?? "", new RegExp(`posted draft ${ID} as octocat: REQUEST_CHANGES with 2 inline comment\\(s\\) at c0ffee11 https://github.com/Acme/x/pull/5#pullrequestreview-99`));
    assert.match(renderDraftList(listDrafts(s)), /\| posted \|/);
    const again = await postDraft(s, postDeps(f), ID, { event: "comment", yes: true });
    assert.deepEqual([again.code, again.out, f.posts.length], [1, `refusing: draft ${ID} revision r1 was already posted (a rewritten draft becomes a new revision)`, 1]);
  });

  it("refuses an unsaved or broken draft", async () => {
    const s = tempStore();
    seed(s, null);
    assert.match((await postDraft(s, postDeps(fake()), ID, { event: "comment", yes: true })).out, /is not saved yet/);
    seed(s, "Verdict: comment\n");
    assert.match((await postDraft(s, postDeps(fake()), ID, { event: "comment", yes: true })).out, /does not parse/);
  });

  it("refuses when the account already reviewed that commit, or the PR is closed", async () => {
    const s = tempStore();
    seed(s);
    const reviewed = fake({ pr: prResponse({ reviews: [review(user(ME), "COMMENTED", "2026-01-12T18:00:00Z", "x", HEAD)] }) });
    assert.match((await postDraft(s, postDeps(reviewed), ID, { event: "comment", yes: true })).out, /already reviewed Acme\/x#5 at c0ffee11/);
    const closed = fake({ pr: prResponse({ state: "MERGED" }) });
    assert.match((await postDraft(s, postDeps(closed), ID, { event: "comment", yes: true })).out, /is MERGED/);
    assert.equal(reviewed.posts.length + closed.posts.length, 0);
  });

  it("posts an approval on a moved head as a comment with an approval-withheld note, pinned to the old commit", async () => {
    const s = tempStore();
    seed(s);
    const moved = fake({ pr: prResponse({ head: "beefbeef00112233445566778899aabbccddeeff" }) });
    const r = await postDraft(s, postDeps(moved), ID, { event: "approve", yes: true });
    assert.equal(r.code, 0);
    assert.match(r.out, /: COMMENT with .* at c0ffee11 \(approve downgraded to COMMENT: approval withheld, head moved to beefbeef\)/);
    const body = JSON.parse(moved.posts[0]?.[3] ?? "{}");
    assert.equal(body.event, "COMMENT");
    assert.equal(body.commit_id, HEAD);
    assert.match(body.body, /\n\napproval withheld: new commits since c0ffee11; the next review cycle covers them$/);
    const ev = s.readEventsFrom(0).events.find((e) => e.type === "review-posted");
    assert.match(ev?.detail ?? "", /approve downgraded to COMMENT/);
  });

  it("posts comment and request-changes on a moved head as-is, pinned to the old commit", async () => {
    for (const event of ["comment", "request-changes"] as const) {
      const s = tempStore();
      seed(s);
      const moved = fake({ pr: prResponse({ head: "beefbeef00112233445566778899aabbccddeeff" }) });
      const r = await postDraft(s, postDeps(moved), ID, { event, yes: true });
      assert.equal(r.code, 0);
      assert.match(r.out, /\(head is now beefbeef\)/);
      const body = JSON.parse(moved.posts[0]?.[3] ?? "{}");
      assert.equal(body.event, event === "comment" ? "COMMENT" : "REQUEST_CHANGES");
      assert.equal(body.commit_id, HEAD);
      assert.doesNotMatch(body.body, /approval withheld/);
    }
  });

  it("approves when the head has not moved", async () => {
    const s = tempStore();
    seed(s);
    const f = fake({});
    const r = await postDraft(s, postDeps(f), ID, { event: "approve", yes: true });
    assert.equal(r.code, 0);
    assert.equal(JSON.parse(f.posts[0]?.[3] ?? "{}").event, "APPROVE");
    assert.doesNotMatch(r.out, /downgraded/);
  });

  it("logs a failed post and lets it be retried", async () => {
    const s = tempStore();
    seed(s);
    const f = fake({ postFails: "HTTP 422: line not in diff" });
    const r = await postDraft(s, postDeps(f), ID, { event: "comment", yes: true });
    assert.deepEqual([r.code, r.out], [1, "post failed: HTTP 422: line not in diff"]);
    assert.deepEqual(s.readEventsFrom(0).events.map((e) => e.type), ["action-failed"]);
    f.postFails = undefined;
    assert.equal((await postDraft(s, postDeps(f), ID, { event: "comment", yes: true })).code, 0);
  });

  it("refuses when the PR cannot be read", async () => {
    const s = tempStore();
    seed(s);
    const f = fake({ readFails: "HTTP 502" });
    assert.match((await postDraft(s, postDeps(f), ID, { event: "comment", yes: true })).out, /refusing: cannot read Acme\/x#5: HTTP 502/);
    assert.equal(f.posts.length, 0);
    mkdirSync(join(s.dir, "drafts", "junk"), { recursive: true });
    assert.equal(listDrafts(s).length, 1);
  });
});

describe("prflow review post: draft revisions", () => {
  const APPROVE = DRAFT.replace("Verdict: request-changes", "Verdict: approve").replace("Nit: name this.", "Nit: name this.\n\n### src/c.ts:7\n\nNew: guard this.");
  const commented = (at = "2026-01-12T17:30:00Z") => review(user(ME), "COMMENTED", at, "x", HEAD);
  const fakeWith = (reviews: unknown[], over: Partial<FakePost> = {}): FakePost => ({ pr: prResponse({ requests: [], decision: null, reviews }), posts: [], reads: [], ...over });

  it("posts a rewritten draft as revision r2 on an already-reviewed head, with only its new inline comments", async () => {
    const s = tempStore();
    const p = seed(s);
    assert.equal((await postDraft(s, postDeps(fakeWith([])), ID, { event: "comment", yes: true })).code, 0);
    // The draft is rewritten after the COMMENT review (incident: Noel asked the reviewer to approve).
    writeFileSync(p.file, APPROVE);
    assert.match(renderDraftList(listDrafts(s)), /\| ready r2 \(earlier revision posted\) \| verdict suggestion approve/);
    assert.match(showDraft(s, ID), /^posted: no, revision r2 \(r1 posted\)$/m);
    const f = fakeWith([commented()]);
    const dry = await postDraft(s, postDeps(f), ID, { event: "approve", yes: false });
    assert.match(dry.out, /^would post: APPROVE review of Acme\/x#5 at c0ffee11 \(draft revision r2\) with 1 inline comment\(s\) \(2 already posted with an earlier revision\), as octocat/);
    const r = await postDraft(s, postDeps(f), ID, { event: "approve", yes: true });
    assert.equal(r.code, 0, r.out);
    const body = JSON.parse(f.posts[0]?.[3] ?? "{}");
    assert.deepEqual([body.event, body.commit_id, body.comments.map((c: { path: string }) => c.path)], ["APPROVE", HEAD, ["src/c.ts"]]);
    assert.match(r.out, new RegExp(`^posted draft ${ID} revision r2 as octocat: APPROVE with 1 inline comment`));
    assert.ok(s.hasLedgerRef(`review-posted:${ID}:r2`));
    assert.match(renderDraftList(listDrafts(s)), /\| posted r2 \|/);
    const again = await postDraft(s, postDeps(fakeWith([commented(), review(user(ME), "APPROVED", "2099-01-01T00:00:00Z", "y", HEAD)])), ID, { event: "approve", yes: true });
    assert.deepEqual([again.code, again.out], [1, `refusing: draft ${ID} revision r2 was already posted`]);
  });

  it("refuses a revision when a review of the commit is newer than it (a lost post record), and posts an approval revision on a moved head as a comment", async () => {
    const s = tempStore();
    const p = seed(s);
    assert.equal((await postDraft(s, postDeps(fakeWith([])), ID, { event: "comment", yes: true })).code, 0);
    writeFileSync(p.file, APPROVE);
    const newer = fakeWith([commented("2099-01-01T00:00:00Z")]);
    assert.match((await postDraft(s, postDeps(newer), ID, { event: "approve", yes: true })).out, /refusing: octocat already reviewed Acme\/x#5 at c0ffee11 \(COMMENTED 2099-01-01T00:00:00Z\) after draft revision r2 was saved/);
    const moved = fakeWith([commented()]);
    moved.pr = prResponse({ requests: [], decision: null, reviews: [commented()], head: "beefbeef00112233445566778899aabbccddeeff" });
    assert.equal(newer.posts.length, 0);
    const r = await postDraft(s, postDeps(moved), ID, { event: "approve", yes: true });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /revision r2 as octocat: COMMENT .*approve downgraded to COMMENT/);
    assert.match(JSON.parse(moved.posts[0]?.[3] ?? "{}").body, /approval withheld: new commits since c0ffee11/);
  });

  it("treats a draft posted before revisions were tracked as revision r1 by its post time and post.json", async () => {
    const s = tempStore();
    const p = seed(s);
    // An older prflow posted it: a ledger row and post.json, no posted.json.
    writeFileSync(join(p.dir, "post.json"), JSON.stringify(reviewPayload(parseDraft(DRAFT), "comment", HEAD)));
    s.addLedger({ at: Date.now() + 60_000, item: "Acme/x#5", version: "c0ffee11", kind: "review-requested", outcome: "posted", detail: "old", source: "prflow", ref: `review-posted:${ID}` });
    assert.match((await postDraft(s, postDeps(fakeWith([commented()])), ID, { event: "comment", yes: true })).out, /revision r1 was already posted/);
    writeFileSync(p.file, APPROVE);
    const later = (Date.now() + 120_000) / 1000;
    utimesSync(p.file, later, later);
    const f = fakeWith([commented()]);
    const r = await postDraft(s, postDeps(f), ID, { event: "approve", yes: true });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(JSON.parse(f.posts[0]?.[3] ?? "{}").comments.map((c: { path: string }) => c.path), ["src/c.ts"]);
    assert.ok(existsSync(join(p.dir, "posted.json")));
    assert.deepEqual(JSON.parse(readFileSync(join(p.dir, "posted.json"), "utf8")).revisions.map((x: { rev: number }) => x.rev), [1, 2]);
  });
});
