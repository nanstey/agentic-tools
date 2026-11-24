import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { DRAFT_HEADER, DRAFT_HEADER_V1, draftId, parseDraft, parseDraftId } from "../scripts/core/draft.ts";
import type { DraftMeta } from "../scripts/core/draft.ts";
import type { PrSnapshot } from "../scripts/core/types.ts";
import { draftWasPosted, listDrafts, renderDraftList, showDraft } from "../scripts/review-cmd.ts";
import { draftPaths, writeMeta } from "../scripts/review.ts";
import { DRAFT, HEAD, ME } from "./fixtures.ts";
import { withStore, withStoreAsync } from "../scripts/store.ts";
import { tempStore } from "./state-helpers.ts";

const ID = `Acme-x-5-${HEAD.slice(0, 8)}`;
const META: DraftMeta = {
  id: ID, item: "Acme/x#5", repo: "Acme/x", number: 5,
  url: "https://github.com/Acme/x/pull/5", title: "Fixture PR", headSha: HEAD,
  account: ME, dispatchId: 1, createdAt: "2026-01-01T00:00:00Z",
};
function snapshot(reviews: PrSnapshot["reviews"], headSha = HEAD, commitOids: string[] = [HEAD]): PrSnapshot {
  return { repo: "Acme/x", number: 5, title: "Fixture PR", url: META.url, role: "reviewer", account: ME,
    state: "OPEN", isDraft: false, headSha, commitOids, branch: "feature", headCommittedDate: "2026-01-01T00:00:00Z",
    mergeStateStatus: "CLEAN", reviewDecision: null, checks: [], comments: [], reviews, threads: [], reviewRequests: [] };
}

describe("draft ids and parsing", () => {
  it("round-trips owner, repo, number, and head", () => {
    assert.equal(draftId("Acme/my-repo", 12, "d5f5da28"), "Acme-my-repo-12-d5f5da28");
    assert.deepEqual(parseDraftId("Acme-my-repo-12-d5f5da28"), { folder: "Acme-my-repo-12", head8: "d5f5da28" });
    assert.equal(parseDraftId("../x-5-d5f5da28"), null);
    assert.throws(() => draftId("a b/x", 1, "d5f5da28"), /bad PR/);
  });

  it("parses the verdict, summary, comments, and notes section", () => {
    const d = parseDraft(DRAFT);
    assert.deepEqual(d.errors, []);
    assert.equal(d.verdict, "request-changes");
    assert.equal(d.summary, "One blocking finding: F1 in src/a.ts.");
    assert.equal(d.comments.length, 2);
  });

  it("ignores the Packet section when parsing inline comments", () => {
    const withPacket = `${DRAFT}\n\n## Packet\n\nVerbatim report.\n\n## Inline comments\n\n### not/a-comment.ts:99\nPacket text is not a draft comment.`;
    const d = parseDraft(withPacket);
    assert.deepEqual(d.errors, []);
    assert.equal(d.comments.length, 2);
    assert.ok(d.comments.every((comment) => comment.path !== "not/a-comment.ts"));
  });

  it("accepts None. for no inline comments and reports malformed drafts", () => {
    assert.equal(parseDraft(DRAFT.replace(/## Inline comments[\s\S]*?## Notes/, "## Inline comments\n\nNone.\n\n## Notes")).comments.length, 0);
    assert.ok(parseDraft("Verdict: maybe").errors.length > 0);
    // A Verdict line quoted inside the packet never stands in for the header verdict.
    const quoted = parseDraft(`${DRAFT_HEADER}\nVerdict: **approve**\n\n## Summary\nOk.\n\n## Inline comments\nNone.\n\n## Packet\nVerdict: approve\n`);
    assert.equal(quoted.verdict, null);
  });
});

describe("draft coverage", () => {
  const v2 = (verdict: string, coverage: string | null, packet = "") =>
    `${DRAFT_HEADER}\n# Review\n\nVerdict: ${verdict}\n${coverage === null ? "" : `Coverage: ${coverage}\n`}\n## Summary\n\nOk.\n\n## Inline comments\n\nNone.\n${packet ? `\n## Packet\n\n${packet}\n` : ""}`;

  it("reads a complete review", () => {
    const d = parseDraft(v2("approve", "complete", "Verdict: clean\nCoverage: all rows done."));
    assert.deepEqual(d.errors, []);
    assert.equal(d.coverage, "complete");
  });

  it("requires the Coverage line in a v2 draft", () => {
    assert.match(parseDraft(v2("approve", null)).errors.join(" "), /missing Coverage line/);
  });

  it("reads an incomplete review, its gaps, and allows only comment", () => {
    const d = parseDraft(v2("comment", "incomplete (bugs: Agent refused twice)"));
    assert.deepEqual(d.errors, []);
    assert.equal(d.coverage, "incomplete");
    assert.equal(d.coverageGaps, "bugs: Agent refused twice");
    assert.match(parseDraft(v2("approve", "incomplete (bugs: Agent refused)")).errors.join(" "), /an incomplete review can only suggest comment, not approve/);
    assert.match(parseDraft(v2("comment", "incomplete")).errors.join(" "), /must name what did not run/);
  });

  it("trusts the packet verdict over a complete Coverage line, and only the packet's first verdict", () => {
    assert.match(parseDraft(v2("approve", "complete", "Verdict: incomplete (no child reviewers)")).errors.join(" "), /Coverage says complete but the packet verdict is incomplete/);
    const quoted = parseDraft(v2("approve", "complete", "Verdict: clean\n\nEarlier packet said:\nVerdict: incomplete (old)"));
    assert.deepEqual(quoted.errors, []);
  });

  it("reads a legacy v1 draft: coverage from its packet, else unknown", () => {
    const v1 = (packet: string) => `${DRAFT_HEADER_V1}\nVerdict: comment\n\n## Summary\n\nOk.\n\n## Inline comments\n\nNone.\n\n## Packet\n\n${packet}\n`;
    const self = parseDraft(v1("Process: coordinator read the diff.\nVerdict: incomplete (no verified request; coverage gaps)."));
    assert.deepEqual(self.errors, []);
    assert.equal(self.coverage, "incomplete");
    assert.equal(self.coverageGaps, "packet verdict is incomplete");
    assert.equal(parseDraft(v1("Verdict: clean")).coverage, "unknown");
  });
});

describe("GitHub-derived draft posted status", () => {
  it("requires a submitted review by the draft account at the reviewed commit", () => {
    assert.equal(draftWasPosted(META, snapshot([{ at: "2026-01-02T00:00:00Z", state: "COMMENTED", body: "", author: { login: ME, typename: "User" }, commitOid: HEAD }])), true);
    assert.equal(draftWasPosted(META, snapshot([{ at: null, state: "PENDING", body: "", author: { login: ME, typename: "User" }, commitOid: HEAD }])), false);
    assert.equal(draftWasPosted(META, snapshot([{ at: "2026-01-02T00:00:00Z", state: "APPROVED", body: "", author: { login: "someone-else", typename: "User" }, commitOid: HEAD }])), false);
  });

  it("recognizes a submitted review at any later commit in the PR snapshot", () => {
    const later = "a".repeat(40);
    const newest = "b".repeat(40);
    const review = { at: "2026-01-02T00:00:00Z", state: "APPROVED", body: "", author: { login: ME, typename: "User" }, commitOid: later };
    assert.equal(draftWasPosted(META, snapshot([review], newest, [HEAD, later, newest])), true);
    assert.equal(draftWasPosted(META, snapshot([review], newest, [later, newest])), false);
  });

  it("rejects the removed publication command without contacting GitHub", () => {
    let status = 0;
    let stderr = "";
    try {
      execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/prflow.ts", import.meta.url)), "review", "post", "x", "--yes"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      const error = e as { status?: number; stderr?: string };
      status = error.status ?? 0;
      stderr = String(error.stderr ?? "");
    }
    assert.notEqual(status, 0);
    assert.match(stderr, /unknown command: prflow review post/);
  });

  it("list and show preserve draft parsing while querying posted status", async () => {
    const s = tempStore();
    try {
      assert.deepEqual(parseDraftId(ID), { folder: "Acme-x-5", head8: HEAD.slice(0, 8) });
      const firstDispatch = s.createDispatch(META.item, HEAD.slice(0, 8), "review-requested", 1);
      const meta = { ...META, dispatchId: firstDispatch.id };
      const paths = draftPaths(s.dir, meta.repo, meta.number, HEAD.slice(0, 8));
      writeMeta(paths, meta);
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(paths.dir, { recursive: true });
      writeFileSync(paths.file, DRAFT);
      s.addLedger({ at: 2, item: meta.item, version: HEAD.slice(0, 8), kind: "review-requested", outcome: "drafted", detail: `${ID}`, dispatchId: firstDispatch.id, source: "prflow", ref: `review-drafted:${firstDispatch.id}` });
      const otherDispatch = s.createDispatch("Acme/y#6", HEAD.slice(0, 8), "review-requested", 1);
      const otherMeta = { ...META, dispatchId: otherDispatch.id, id: `Acme-y-6-${HEAD.slice(0, 8)}`, item: "Acme/y#6", repo: "Acme/y", number: 6, url: "https://github.com/Acme/y/pull/6" };
      const otherPaths = draftPaths(s.dir, otherMeta.repo, otherMeta.number, HEAD.slice(0, 8));
      writeMeta(otherPaths, otherMeta);
      mkdirSync(otherPaths.dir, { recursive: true });
      writeFileSync(otherPaths.file, DRAFT);
      s.addLedger({ at: 2, item: otherMeta.item, version: HEAD.slice(0, 8), kind: "review-requested", outcome: "drafted", detail: `${otherMeta.id}`, dispatchId: otherDispatch.id, source: "prflow", ref: `review-drafted:${otherDispatch.id}` });
      const read = async () => snapshot([{ at: "2026-01-02T00:00:00Z", state: "COMMENTED", body: "", author: { login: ME, typename: "User" }, commitOid: HEAD }]);
      const rows = await listDrafts(s, read, () => ME);
      assert.equal(rows.length, 2);
      assert.equal(rows.find((row) => row.item === META.item)?.posted, true);
      assert.deepEqual(rows.find((row) => row.item === META.item)?.errors, []);
      assert.match(renderDraftList(rows), /posted/);
      assert.match(renderDraftList(rows), /verdict suggestion request-changes \| review complete \|/);
      assert.equal(rows[0]?.coverage, "complete");
      assert.match(await showDraft(s, ID, read, () => ME), /^coverage: complete$/m);
      for (const tampered of [{ ...meta, number: 9 }, { ...meta, url: "https://github.com/Acme/x/pull/9" }, { ...meta, account: "attacker" }]) {
        writeMeta(paths, tampered);
        const invalid = await listDrafts(s, read, () => ME);
        assert.match(invalid.find((row) => row.id === ID)?.errors.join(" ") ?? "", /meta mismatch:/);
        assert.match(await showDraft(s, ID, read, () => ME), /PR: invalid target/);
      }
      writeMeta(paths, { ...meta, headSha: 42 } as unknown as typeof meta);
      assert.match((await listDrafts(s, read, () => ME)).find((row) => row.id === ID)?.errors.join(" ") ?? "", /malformed meta\.json/);
      writeMeta(paths, { ...meta, account: "attacker" });
      const leaked = await showDraft(s, ID, read, () => ME);
      assert.match(leaked, /^account: invalid$/m);
      assert.match(leaked, /^head: invalid$/m);
      assert.doesNotMatch(leaked, /attacker/);
      writeMeta(paths, meta);
      // An edit to an unposted draft stays valid: the reviewer may revise it.
      writeFileSync(paths.file, `${DRAFT}\nchanged`);
      assert.deepEqual((await listDrafts(s, read, () => ME)).find((row) => row.id === ID)?.errors, []);
      writeFileSync(paths.file, DRAFT);
      const degraded = await listDrafts(s, async (meta) => {
        if (meta.item === META.item) throw new Error("cannot read Acme/x#5:\n  offline");
        return null;
      });
      assert.equal(degraded.length, 2);
      assert.equal(degraded.find((row) => row.item === META.item)?.posted, null);
      assert.equal(degraded.find((row) => row.item === META.item)?.postedError, "cannot read Acme/x#5: offline");
      assert.equal(degraded.find((row) => row.item === otherMeta.item)?.posted, false);
      assert.ok(renderDraftList(degraded).includes("posted: unknown (cannot read Acme/x#5: offline)"));
      assert.match(await showDraft(s, ID, read), /posted: yes/);
      assert.match(await showDraft(s, ID, async () => null), /posted: no/);
    } finally { s.close(); }
  });

  it("keeps the CLI store open while list and show await GitHub reads", async () => {
    const s = tempStore();
    const dir = s.dir;
    try {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      // Two drafts: the list reads the store again after the first GitHub read.
      for (const [repo, number] of [["Acme/x", 5], ["Acme/y", 6]] as const) {
        const item = `${repo}#${number}`;
        const dispatch = s.createDispatch(item, HEAD.slice(0, 8), "review-requested", 1);
        const meta = { ...META, dispatchId: dispatch.id, id: draftId(repo, number, HEAD.slice(0, 8)), item, repo, number, url: `https://github.com/${repo}/pull/${number}` };
        const paths = draftPaths(s.dir, repo, number, HEAD.slice(0, 8));
        writeMeta(paths, meta);
        mkdirSync(paths.dir, { recursive: true });
        writeFileSync(paths.file, DRAFT);
        s.addLedger({ at: 2, item, version: HEAD.slice(0, 8), kind: "review-requested", outcome: "drafted", detail: meta.id, dispatchId: dispatch.id, source: "prflow", ref: `review-drafted:${dispatch.id}` });
      }
    } finally { s.close(); }
    // A real gh read yields to the event loop before resolving.
    const slowRead = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return null;
    };
    const rows = await withStoreAsync(dir, (store) => listDrafts(store, slowRead, () => ME));
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.deepEqual(row.errors, []);
      assert.equal(row.posted, false);
    }
    assert.match(await withStoreAsync(dir, (store) => showDraft(store, ID, slowRead, () => ME)), /posted: no/);
    assert.throws(() => withStore(dir, (store) => listDrafts(store, slowRead, () => ME)), /use withStoreAsync/);
  });
});
