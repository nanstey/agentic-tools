import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacyCovers, parseLegacy } from "../scripts/core/legacy.ts";

describe("parseLegacy", () => {
  it("parses pr-comment-watch lines with kind and optional detail", () => {
    const { entries, bad } = parseLegacy(
      "pr-comment-watch",
      ["Acme/x#271@9cc2a137:comments:2026-09-24T19:10:57Z", "Acme/x#271@9cc2a137:ci", "Acme/x#2@aaaaaaaa:merge", "Acme/x#3@bbbbbbbb:behind", "Acme/x#4@cccccccc:ci", "Acme/x#271@9cc2a137:ci", ""].join("\n"),
    );
    assert.deepEqual(bad, []);
    assert.deepEqual(
      entries.map((e) => [e.item, e.version, e.kind, e.detail]),
      [
        ["Acme/x#271", "9cc2a137", "comments", "2026-09-24T19:10:57Z"],
        ["Acme/x#271", "9cc2a137", "ci", null],
        ["Acme/x#2", "aaaaaaaa", "mergeable", null],
        ["Acme/x#3", "bbbbbbbb", "behind", null],
        ["Acme/x#4", "cccccccc", "ci", null],
      ],
    );
  });

  it("maps pr-watch lines to review-requested", () => {
    const { entries } = parseLegacy("pr-watch", "Acme/w#587@20b3ff8a\n");
    assert.deepEqual(entries.map((e) => [e.item, e.kind, e.ref]), [["Acme/w#587", "review-requested", "legacy:pr-watch:Acme/w#587@20b3ff8a"]]);
  });

  it("rejects unknown kinds, kinds in pr-watch, and malformed lines", () => {
    assert.deepEqual(parseLegacy("pr-comment-watch", "A/x#1@aaaaaaaa:explode\nA/x#1@aaaaaaaa:rerun\nA/x#1@aaaaaaaa\nnope").bad, ["A/x#1@aaaaaaaa:explode", "A/x#1@aaaaaaaa:rerun", "A/x#1@aaaaaaaa", "nope"]);
    assert.deepEqual(parseLegacy("pr-watch", "A/x#1@aaaaaaaa:ci\nA/x#1@zz").bad, ["A/x#1@aaaaaaaa:ci", "A/x#1@zz"]);
  });
});

describe("legacyCovers", () => {
  const e = { item: "Acme/x#1", version: "9cc2a137", kind: "ci" as const, detail: null };
  it("matches the same item, kind, and head prefix", () => {
    assert.ok(legacyCovers(e, "acme/X#1", "9cc2a137-deadbeef", "ci", null));
    assert.ok(!legacyCovers(e, "Acme/x#1", "9cc2a138-deadbeef", "ci", null));
    assert.ok(!legacyCovers(e, "Acme/x#1", "9cc2a137-deadbeef", "behind", null));
    assert.ok(!legacyCovers(e, "Acme/x#2", "9cc2a137-deadbeef", "ci", null));
  });
  it("requires the same detail when the legacy entry recorded one", () => {
    const c = { ...e, kind: "comments" as const, detail: "T1" };
    assert.ok(legacyCovers(c, "Acme/x#1", "9cc2a137-x", "comments", "T1"));
    assert.ok(!legacyCovers(c, "Acme/x#1", "9cc2a137-x", "comments", "T2"));
  });
  it("needs at least 7 sha characters to match", () => {
    assert.ok(!legacyCovers({ ...e, version: "9cc2a1" }, "Acme/x#1", "9cc2a137-x", "ci", null));
  });
});
