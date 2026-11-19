import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { BriefFacts } from "../scripts/adapters/gh.ts";
import { loadTemplates } from "../scripts/agents.ts";
import { SKILL_DIR } from "../scripts/config.ts";
import { feedbackItems, logExcerpt, NO_SELF_EDIT, parseTemplate, render } from "../scripts/core/brief.ts";

const T = loadTemplates(join(SKILL_DIR, "templates", "briefs"));
const u = (login: string) => ({ login, typename: "User" });

describe("brief templates", () => {
  it("are versioned and end with the no-self-edit note", () => {
    for (const [k, t] of Object.entries(T)) {
      assert.match(t.id, new RegExp(`^${k} v\\d+$`));
      const last = t.body.trim().split("\n").at(-1) ?? "";
      assert.ok(last.startsWith(NO_SELF_EDIT), `${k}: ${last}`);
    }
  });

  it("state the hard rules in every code-work brief", () => {
    for (const k of ["ci", "comments", "behind"] as const) {
      const b = T[k].body;
      assert.match(b, /Never check out, commit to, or push any other branch\./, k);
      assert.match(b, /Never merge(?: the PR)?, enable auto-merge, approve, dismiss reviews, or force-push\./, k);
      assert.match(b, /Stop after pushing/, k);
      assert.match(b, /\{\{pr_url\}\}/, k);
    }
    assert.match(T.comments.body, /Reply to each item you addressed.*Resolve a review thread/s);
  });

  it("refuse to render with a missing value or a bad header", () => {
    assert.throws(() => render(T.ci, {}), /brief ci v1: no value for \{\{repo\}\}/);
    assert.throws(() => parseTemplate("ci", "# no header\n"), /first line must be/);
    assert.throws(() => parseTemplate("ci", "<!-- prflow brief: behind v1 -->\nx"), /first line must be/);
  });
});

describe("logExcerpt", () => {
  it("strips job, step, and timestamps and keeps error lines", () => {
    const log = ["build\tsetup\t2026-01-01T00:00:00.1Z installing", "build\ttest\t2026-01-01T00:00:01.2Z Error: boom", "build\ttest\t2026-01-01T00:00:02.3Z done"].join("\n");
    assert.equal(logExcerpt(log), "Error: boom");
    assert.equal(logExcerpt("a\nb"), "a\nb");
  });
});

describe("feedbackItems", () => {
  const facts: BriefFacts = {
    baseRef: "main",
    headRef: "feat",
    comments: [
      { at: "2026-01-10T11:00:00Z", author: u("alice"), url: "u0", body: "before head" },
      { at: "2026-01-10T13:00:00Z", author: u("alice"), url: "u1", body: "please rename" },
      { at: "2026-01-10T13:30:00Z", author: u("me"), url: "u2", body: "done" },
      { at: "2026-01-10T14:00:00Z", author: u("bob"), url: "u3", body: "one more" },
      { at: "2026-01-10T14:00:00Z", author: { login: "ci", typename: "Bot" }, url: "u4", body: "bot" },
    ],
    reviews: [
      { at: "2026-01-10T14:10:00Z", author: u("carol"), url: "r1", body: "lgtm", state: "APPROVED" },
      { at: "2026-01-10T14:20:00Z", author: u("dave"), url: "r2", body: "", state: "CHANGES_REQUESTED" },
    ],
    threads: [
      { isResolved: false, path: "src/a.ts", line: 3, comments: [{ at: "2026-01-10T13:10:00Z", author: u("erin"), url: "t1", body: "why?" }] },
      { isResolved: true, path: "src/b.ts", line: 1, comments: [{ at: "2026-01-10T13:10:00Z", author: u("erin"), url: "t2", body: "x" }] },
      { isResolved: false, path: "src/c.ts", line: 1, comments: [{ at: "2026-01-10T13:10:00Z", author: u("me"), url: "t3", body: "answered" }] },
    ],
  };
  it("lists unanswered human feedback after the head and the author's last reply, plus open threads", () => {
    const items = feedbackItems(facts, "2026-01-10T12:00:00Z", "me");
    assert.equal(items.length, 3);
    assert.match(items[0] ?? "", /^- Unresolved thread on `src\/a\.ts:3`, last comment t1\n {2}- \*\*erin\*\*/);
    assert.match(items[1] ?? "", /^- \*\*bob\*\* commented \(2026-01-10 14:00Z\) u3\n {2}> one more$/);
    assert.match(items[2] ?? "", /^- \*\*dave\*\* requested changes/);
  });
});
